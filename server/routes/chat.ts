/**
 * AI 聊天路由 - 讲解模式
 * 学生直接问 AI 答案和详细解题过程(与诊断的苏格拉底式启发不同)
 *
 * 两个端点:
 *   POST /api/chat        - 一次性返回完整回复(兼容旧调用)
 *   POST /api/chat/stream - SSE 流式响应,逐段返回(打字机效果)
 */
import { Router, type Request, type Response } from 'express';
import { chatWithAI, chatStreamWithAI, isAIConfigured, type ChatMessage } from '../services/ai-engine.js';
import type { Subject } from '../../shared/types.js';

const VALID_SUBJECTS: Subject[] = ['math', 'physics', 'chemistry'];

function parseSubject(s: any): Subject {
  return VALID_SUBJECTS.includes(s) ? s : 'math';
}

const router = Router();

// POST /api/chat - 一次性返回完整回复(兼容旧调用)
router.post('/', async (req: Request, res: Response) => {
  const { message, subject, history } = req.body as {
    message: string;
    subject: Subject;
    history?: ChatMessage[];
  };

  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ success: false, error: '消息不能为空' });
    return;
  }

  const subj = parseSubject(subject);
  const hist = Array.isArray(history) ? history.filter(m => m && m.role && m.content) : [];

  try {
    const reply = await chatWithAI(message, subj, hist);
    res.json({
      success: true,
      data: { reply, aiEnabled: isAIConfigured() },
    });
  } catch (err: any) {
    console.error('AI 聊天失败:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'AI 回复失败,请稍后重试',
    });
  }
});

// POST /api/chat/stream - SSE 流式响应(打字机效果)
// 响应格式:text/event-stream
// 每个 chunk:data: {"delta":"一段文本"}\n\n
// 结束:data: [DONE]\n\n
router.post('/stream', async (req: Request, res: Response) => {
  const { message, subject, history } = req.body as {
    message: string;
    subject: Subject;
    history?: ChatMessage[];
  };

  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ success: false, error: '消息不能为空' });
    return;
  }

  const subj = parseSubject(subject);
  const hist = Array.isArray(history) ? history.filter(m => m && m.role && m.content) : [];

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // 关闭 Nagle 算法,让小 chunk 立即发送(打字机效果关键)
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // 客户端断开时清理
  let aborted = false;
  req.on('close', () => { aborted = true; });

  try {
    let fullText = '';
    for await (const delta of chatStreamWithAI(message, subj, hist)) {
      if (aborted) break;
      fullText += delta;
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    }
    // 流结束标记,告诉前端这条消息已完整
    if (!aborted) {
      res.write(`data: ${JSON.stringify({ done: true, full: fullText })}\n\n`);
      res.write('data: [DONE]\n\n');
    }
  } catch (err: any) {
    console.error('AI 流式聊天失败:', err);
    if (!aborted) {
      res.write(`data: ${JSON.stringify({ error: err.message || 'AI 回复失败' })}\n\n`);
      res.write('data: [DONE]\n\n');
    }
  } finally {
    res.end();
  }
});

export default router;
