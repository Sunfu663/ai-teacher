/**
 * AI 诊断路由
 */
import { Router, type Request, type Response } from 'express';
import { analyzeSolution, isAIConfigured } from '../services/ai-engine.js';
import { addErrorRecord } from '../services/notebook-service.js';
import { increaseTagWeights } from '../services/tag-service.js';
import { updateStreak } from '../services/profile-service.js';
import type { AnalyzeRequest, Subject } from '../../shared/types.js';

const VALID_SUBJECTS: Subject[] = ['math', 'physics', 'chemistry'];

const router = Router();

// POST /api/analyze - 诊断学生解题步骤
router.post('/', async (req: Request, res: Response) => {
  try {
    const { question, steps, mode, subject } = req.body as AnalyzeRequest;

    if (!question || !Array.isArray(steps)) {
      res.status(400).json({ success: false, error: '参数缺失:需要 question 和 steps' });
      return;
    }
    const subj: Subject = VALID_SUBJECTS.includes(subject) ? subject : 'math';

    updateStreak();
    const diagnosis = await analyzeSolution({ question, steps, mode: mode || 'check', subject: subj });

    // 若存在错误,自动存入错题本并增强标签权重(同学科)
    let errorRecord = null;
    if (!diagnosis.isCorrect && diagnosis.weakTags.length > 0) {
      errorRecord = addErrorRecord(question, steps, diagnosis, subj);
      increaseTagWeights(diagnosis.weakTags, subj);
    }

    res.json({ success: true, data: { diagnosis, errorRecord, aiEnabled: isAIConfigured() } });
  } catch (err: any) {
    console.error('诊断失败:', err);
    res.status(500).json({ success: false, error: '诊断服务异常: ' + err.message });
  }
});

export default router;
