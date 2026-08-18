/**
 * 题库路由
 */
import { Router, type Request, type Response } from 'express';
import { getDb } from '../db.js';
import type { Question, Subject } from '../../shared/types.js';

const VALID_SUBJECTS: Subject[] = ['math', 'physics', 'chemistry'];

const router = Router();

function rowToQuestion(r: any): Question {
  return {
    id: r.id,
    content: r.content,
    answer: r.answer,
    type: r.type,
    options: r.options ? JSON.parse(r.options) : undefined,
    knowledgePoints: JSON.parse(r.knowledge_points || '[]'),
    tags: JSON.parse(r.tags || '[]'),
    subject: r.subject as Subject,
  };
}

// GET /api/questions - 获取题目列表(可选 ?subject=math &count=N)
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const subject = VALID_SUBJECTS.includes(req.query.subject as Subject) ? req.query.subject as Subject : undefined;

  let rows: any[];
  if (subject) {
    rows = db.prepare('SELECT * FROM questions WHERE subject = ? ORDER BY RANDOM()').all(subject);
  } else {
    rows = db.prepare('SELECT * FROM questions ORDER BY RANDOM()').all();
  }
  const questions = rows.map(rowToQuestion);

  const count = req.query.count ? parseInt(req.query.count as string) : undefined;
  const result = count ? questions.slice(0, count) : questions;

  res.json({ success: true, data: result });
});

// GET /api/questions/:id
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(parseInt(req.params.id)) as any;
  if (!row) {
    res.status(404).json({ success: false, error: '题目不存在' });
    return;
  }
  res.json({ success: true, data: rowToQuestion(row) });
});

export default router;
