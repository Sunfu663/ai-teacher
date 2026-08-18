/**
 * 每日十题路由
 */
import { Router, type Request, type Response } from 'express';
import { generateDailyQuestions, submitDailyResults } from '../services/daily-service.js';
import { updateStreak } from '../services/profile-service.js';
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
