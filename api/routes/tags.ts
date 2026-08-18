/**
 * 标签路由
 */
import { Router, type Request, type Response } from 'express';
import { getAllTags, getTopWeakTags } from '../services/tag-service.js';
import type { Subject } from '../../shared/types.js';

const VALID_SUBJECTS: Subject[] = ['math', 'physics', 'chemistry'];

function parseSubject(s: any): Subject | undefined {
  return VALID_SUBJECTS.includes(s) ? s : undefined;
}

const router = Router();

// GET /api/tags - 获取所有标签及权重(可选 ?subject=math)
router.get('/', (req: Request, res: Response) => {
  const subject = parseSubject(req.query.subject);
  res.json({ success: true, data: getAllTags(subject) });
});

// GET /api/tags/top - 获取权重最高的标签(可选 ?subject=math &n=3)
router.get('/top', (req: Request, res: Response) => {
  const n = parseInt(req.query.n as string) || 3;
  const subject = parseSubject(req.query.subject);
  res.json({ success: true, data: getTopWeakTags(n, subject) });
});

export default router;
