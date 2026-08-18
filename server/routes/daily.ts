/**
 * 每日十题路由
 */
import { Router, type Request, type Response } from 'express';
import { generateDailyQuestions, submitDailyResults } from '../services/daily-service.js';
import { updateStreak } from '../services/profile-service.js';
import { ocrCheckAnswer } from '../services/ai-engine.js';
import type { Subject } from '../../shared/types.js';

const VALID_SUBJECTS: Subject[] = ['math', 'physics', 'chemistry'];

const router = Router();

// GET /api/daily/generate - 生成今日10题(?subject=math &count=10)
router.get('/generate', (req: Request, res: Response) => {
  try {
    const subject = VALID_SUBJECTS.includes(req.query.subject as Subject) ? req.query.subject as Subject : 'math';
    const count = parseInt(req.query.count as string) || 10;
    const questions = generateDailyQuestions(subject, count);
    res.json({ success: true, data: questions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/daily/ocr-check - 拍照判分(图片+题目+正确答案 -> 识别答案+对错)
router.post('/ocr-check', async (req: Request, res: Response) => {
  try {
    const { image, question, correctAnswer, subject } = req.body as {
      image: string;
      question: string;
      correctAnswer: string;
      subject: Subject;
    };
    if (!image || !question || !correctAnswer) {
      res.status(400).json({ success: false, error: '参数缺失:需要 image, question, correctAnswer' });
      return;
    }
    const subj: Subject = VALID_SUBJECTS.includes(subject) ? subject : 'math';
    const result = await ocrCheckAnswer({ image, question, correctAnswer, subject: subj });
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('图片判分失败:', err);
    res.status(500).json({ success: false, error: '图片判分失败: ' + err.message });
  }
});

// POST /api/daily/submit - 提交作答结果
router.post('/submit', (req: Request, res: Response) => {
  try {
    const { results, subject } = req.body as {
      results: { questionId: number; correct: boolean; userAnswer?: string }[];
      subject: Subject;
    };
    const subj: Subject = VALID_SUBJECTS.includes(subject as Subject) ? subject : 'math';
    updateStreak();
    const report = submitDailyResults(results, subj);
    res.json({ success: true, data: report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
