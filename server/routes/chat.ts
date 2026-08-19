/**
 * AI 聊天路由 - 讲解模式
 * 学生直接问 AI 答案和详细解题过程(与诊断的苏格拉底式启发不同)
 */
import { Router, type Request, type Response } from 'express';
import { chatWithAI, isAIConfigured, type ChatMessage } from '../services/ai-engine.js';
import type { Subject } from '../../shared/types.js';

const VALID_SUBJECTS: Subject[] = ['math', 'physics', 'chemistry'];

function parseSubject(s: any): Subject {
  return VALID_SUBJECTS.includes(s) ? s : 'math';
}

const router = Router();

// POST /api/chat - 发送消息给 AI,获取讲解回复
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

export default router;
