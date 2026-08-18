/**
 * AI 诊断路由
 */
import { Router, type Request, type Response } from 'express';
import { analyzeSolution, isAIConfigured, isVisionConfigured } from '../services/ai-engine.js';
import { addErrorRecord } from '../services/notebook-service.js';
import { increaseTagWeights } from '../services/tag-service.js';
import { updateStreak } from '../services/profile-service.js';
import type { AnalyzeRequest, Subject } from '../../shared/types.js';

const VALID_SUBJECTS: Subject[] = ['math', 'physics', 'chemistry'];

const router = Router();

// POST /api/analyze - 诊断学生解题步骤(支持文本步骤或图片)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { question, steps, mode, subject, image } = req.body as AnalyzeRequest;

    if (!question) {
      res.status(400).json({ success: false, error: '参数缺失:需要 question' });
      return;
    }
    // 图片模式:question必须有,image是base64字符串;文本模式:steps必须有
    if (!image && !Array.isArray(steps)) {
      res.status(400).json({ success: false, error: '参数缺失:需要 steps 或 image' });
      return;
    }
    const subj: Subject = VALID_SUBJECTS.includes(subject) ? subject : 'math';

    updateStreak();
    const diagnosis = await analyzeSolution({
      question,
      steps: steps || [],
      mode: mode || 'check',
      subject: subj,
      image,
    });

    // 若存在错误,自动存入错题本并增强标签权重(同学科)
    // 图片模式下,用识别出的电子版步骤替代空数组
    let errorRecord = null;
    if (!diagnosis.isCorrect && diagnosis.weakTags.length > 0) {
      const stepsToSave = diagnosis.recognizedSteps && diagnosis.recognizedSteps.length > 0
        ? diagnosis.recognizedSteps
        : (steps || []);
      errorRecord = addErrorRecord(question, stepsToSave, diagnosis, subj);
      increaseTagWeights(diagnosis.weakTags, subj);
    }

    res.json({
      success: true,
      data: {
        diagnosis,
        errorRecord,
        aiEnabled: isAIConfigured(),
        visionEnabled: isVisionConfigured(),
      },
    });
  } catch (err: any) {
    console.error('诊断失败:', err);
    res.status(500).json({ success: false, error: '诊断服务异常: ' + err.message });
  }
});

export default router;
