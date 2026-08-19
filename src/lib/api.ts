/**
 * API 客户端 - 统一封装所有后端接口调用
 * 所有数据接口按 subject (学科) 过滤
 */
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  ErrorRecord,
  TagWithWeight,
  Question,
  DailyResult,
  DailyReport,
  ProfileData,
  Subject,
} from '../types';

// API 基础地址：App 打包后访问云端 API；本地开发走 vite 代理
const API_BASE = import.meta.env.VITE_API_BASE || '';

// 从 localStorage 读取 token(避免循环依赖,直接读 storage)
function getToken(): string | null {
  try {
    const raw = localStorage.getItem('ai-teacher-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token || null;
  } catch {
    return null;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // 合并调用方传入的 headers(优先级低于 token)
  const mergedHeaders = { ...(options?.headers as Record<string, string> | undefined), ...headers };
  const resp = await fetch(API_BASE + url, {
    ...options,
    headers: mergedHeaders,
  });
  // 兼容空响应(204 No Content 或 body 为空)避免 JSON 解析报错
  const text = await resp.text();
  if (!text) return undefined as T;
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`响应解析失败 (HTTP ${resp.status})`);
  }
  if (!data.success) throw new Error(data.error || '请求失败');
  return data.data as T;
}

// 拼接 query 参数
function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}

// AI 诊断(支持文本步骤或图片,req.image 传 base64 字符串时走视觉模型)
export async function analyzeSolution(req: AnalyzeRequest): Promise<{
  diagnosis: AnalyzeResponse;
  errorRecord: ErrorRecord | null;
  aiEnabled: boolean;
  visionEnabled?: boolean;
}> {
  return request('/api/analyze', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

// 错题本
export async function getNotebook(subject: Subject, tag?: string): Promise<ErrorRecord[]> {
  return request(`/api/notebook${qs({ subject, tag })}`);
}

export async function getRecentErrors(subject: Subject, n = 3): Promise<ErrorRecord[]> {
  return request(`/api/notebook/recent${qs({ subject, n })}`);
}

export async function deleteError(id: number): Promise<void> {
  await request(`/api/notebook/${id}`, { method: 'DELETE' });
}

export async function redoError(id: number, correct: boolean, tags: string[], subject: Subject) {
  return request(`/api/notebook/${id}/redo`, {
    method: 'POST',
    body: JSON.stringify({ correct, tags, subject }),
  });
}

// 标签
export async function getTags(subject: Subject): Promise<TagWithWeight[]> {
  return request(`/api/tags${qs({ subject })}`);
}

export async function getTopWeakTags(subject: Subject, n = 3): Promise<TagWithWeight[]> {
  return request(`/api/tags/top${qs({ subject, n })}`);
}

// 每日十题
export async function generateDaily(subject: Subject, count = 10): Promise<Question[]> {
  return request(`/api/daily/generate${qs({ subject, count })}`);
}

export async function submitDaily(subject: Subject, results: DailyResult[]): Promise<DailyReport> {
  return request('/api/daily/submit', {
    method: 'POST',
    body: JSON.stringify({ results, subject }),
  });
}

// 每日十题拍照判分:图片+题目+正确答案 -> 识别答案+对错(一次GLM-4V调用)
export async function ocrCheckAnswer(opts: {
  image: string;
  question: string;
  correctAnswer: string;
  subject: Subject;
}): Promise<{ recognizedAnswer: string; isCorrect: boolean }> {
  return request('/api/daily/ocr-check', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}

// 画像
export async function getProfile(subject: Subject): Promise<ProfileData> {
  return request(`/api/profile${qs({ subject })}`);
}

// AI 聊天(讲解模式:直接给答案和详细过程分析)
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function chatWithAI(
  message: string,
  subject: Subject,
  history: ChatMessage[] = [],
): Promise<{ reply: string; aiEnabled: boolean }> {
  return request('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message, subject, history }),
  });
}

// AI 聊天流式接口(打字机效果):返回 async generator,逐段 yield 文本增量
// 用法:for await (const delta of chatWithAIStream(...)) { ... }
export async function* chatWithAIStream(
  message: string,
  subject: Subject,
  history: ChatMessage[] = [],
): AsyncGenerator<string, void, unknown> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const resp = await fetch(API_BASE + '/api/chat/stream', {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, subject, history }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI 接口错误 (HTTP ${resp.status}): ${text}`);
  }

  if (!resp.body) {
    throw new Error('AI 接口未返回响应流');
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.delta) yield parsed.delta as string;
          // done 字段是流结束标记,跳过(完整文本已通过 delta 累积)
        } catch (e) {
          // error 类型需要抛出让上层捕获
          if (e instanceof Error && e.message && !e.message.includes('JSON')) {
            throw e;
          }
          // JSON 解析失败,跳过(部分包)
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// 题库
export async function getQuestions(subject: Subject, count?: number): Promise<Question[]> {
  return request(`/api/questions${qs({ subject, count })}`);
}

// ===== 认证相关 =====

export async function register(opts: { username: string; password: string; name?: string }): Promise<{ token: string; user: { id: number; username: string; name: string } }> {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}

export async function login(opts: { username: string; password: string }): Promise<{ token: string; user: { id: number; username: string; name: string } }> {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}

export async function getMe(): Promise<{ user: { id: number; username: string | null; phone: string | null; name: string } }> {
  return request('/api/auth/me');
}
