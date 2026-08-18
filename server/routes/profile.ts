/**
 * 学生画像路由
 */
import { Router, type Request, type Response } from 'express';
import { getProfile } from '../services/profile-service.js';
import type { Subject } from '../../shared/types.js';

const VALID_SUBJECTS: Subject[] = ['math', 'physics', 'chemistry'];

const router = Router();

// GET /api/profile - 获取学生画像(可选 ?subject=math)
router.get('/', (req: Request, res: Response) => {
  const subject = VALID_SUBJECTS.includes(req.query.subject as Subject) ? req.query.subject as Subject : undefined;
  res.json({ success: true, data: getProfile(subject) });
});

export default router;
