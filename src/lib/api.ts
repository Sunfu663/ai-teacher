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

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(API_BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await resp.json();
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

// 题库
export async function getQuestions(subject: Subject, count?: number): Promise<Question[]> {
  return request(`/api/questions${qs({ subject, count })}`);
}
