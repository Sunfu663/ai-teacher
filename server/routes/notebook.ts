/**
 * 错题本路由
 */
import { Router, type Request, type Response } from 'express';
import {
  getErrorRecords,
  deleteErrorRecord,
  getRecentErrors,
  updateMastery,
} from '../services/notebook-service.js';
import { decreaseTagWeights, increaseTagWeights } from '../services/tag-service.js';
import type { Subject } from '../../shared/types.js';

const VALID_SUBJECTS: Subject[] = ['math', 'physics', 'chemistry'];

function parseSubject(s: any): Subject | undefined {
  return VALID_SUBJECTS.includes(s) ? s : undefined;
}

const router = Router();

// GET /api/notebook - 获取错题列表(可选 ?subject=math &tag=xxx 筛选)
router.get('/', (req: Request, res: Response) => {
  const subject = parseSubject(req.query.subject);
  const tag = req.query.tag as string | undefined;
  const records = getErrorRecords(subject, tag);
  res.json({ success: true, data: records });
});

// GET /api/notebook/recent - 最近错题(可选 ?subject=math)
router.get('/recent', (req: Request, res: Response) => {
  const n = parseInt(req.query.n as string) || 3;
  const subject = parseSubject(req.query.subject);
  res.json({ success: true, data: getRecentErrors(n, subject) });
});

// DELETE /api/notebook/:id - 删除错题
router.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  deleteErrorRecord(id);
  res.json({ success: true });
});

// POST /api/notebook/:id/redo - 重做错题反馈
router.post('/:id/redo', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { correct, tags, subject } = req.body as { correct: boolean; tags: string[]; subject: Subject };
  const subj: Subject = VALID_SUBJECTS.includes(subject) ? subject : 'math';
  updateMastery(id, correct);
  const changes = correct
    ? decreaseTagWeights(tags || [], subj)
    : increaseTagWeights(tags || [], subj);
  res.json({ success: true, data: { tagChanges: changes } });
});

export default router;
