/**
 * 错题本服务 - 错题的收录、查询、删除与重做
 * 错题按学科归属,查询时按 subject 过滤
 */
import { getDb, ensureDefaultStudent } from '../db.js';
import type { ErrorRecord, AnalyzeResponse, Subject } from '../../shared/types.js';

const STUDENT_ID = () => ensureDefaultStudent();

// 新增错题(来自 AI 诊断结果,带学科)
export function addErrorRecord(
  question: string,
  studentSteps: string[],
  diagnosis: AnalyzeResponse,
  subject: Subject,
): ErrorRecord {
  const db = getDb();
  const sid = STUDENT_ID();
  const now = new Date().toISOString();

  const info = db.prepare(`
    INSERT INTO error_records (student_id, question, student_steps, diagnosis_type, core_error, guidance, knowledge_points, tags, subject, mastery, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 50, ?)
  `).run(
    sid,
    question,
    JSON.stringify(studentSteps),
    diagnosis.diagnosisType,
    diagnosis.coreError,
    diagnosis.guidance,
    JSON.stringify(diagnosis.knowledgePoints),
    JSON.stringify(diagnosis.weakTags),
    subject,
    now,
  );

  return getErrorRecord(Number(info.lastInsertRowid))!;
}

function rowToRecord(r: any): ErrorRecord {
  return {
    id: r.id,
    question: r.question,
    studentSteps: JSON.parse(r.student_steps),
    diagnosisType: r.diagnosis_type,
    coreError: r.core_error,
    guidance: r.guidance || '',
    knowledgePoints: JSON.parse(r.knowledge_points || '[]'),
    tags: JSON.parse(r.tags || '[]'),
    subject: r.subject as Subject,
    createdAt: r.created_at,
    mastery: r.mastery,
  };
}

// 获取错题列表(可按标签和学科筛选)
export function getErrorRecords(subject?: Subject, tag?: string): ErrorRecord[] {
  const db = getDb();
  const sid = STUDENT_ID();
  let rows: any[];

  if (tag && subject) {
    rows = db.prepare(`
      SELECT * FROM error_records
      WHERE student_id = ? AND subject = ? AND tags LIKE ?
      ORDER BY created_at DESC
    `).all(sid, subject, `%"${tag}"%`);
  } else if (subject) {
    rows = db.prepare(`
      SELECT * FROM error_records
      WHERE student_id = ? AND subject = ?
      ORDER BY created_at DESC
    `).all(sid, subject);
  } else {
    rows = db.prepare(`
      SELECT * FROM error_records
      WHERE student_id = ?
      ORDER BY created_at DESC
    `).all(sid);
  }

  return rows.map(rowToRecord);
}

// 获取单个错题
export function getErrorRecord(id: number): ErrorRecord | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM error_records WHERE id = ?').get(id) as any;
  return row ? rowToRecord(row) : undefined;
}

// 获取最近的 N 条错题(可按学科)
export function getRecentErrors(n: number, subject?: Subject): ErrorRecord[] {
  const db = getDb();
  const sid = STUDENT_ID();
  let rows: any[];
  if (subject) {
    rows = db.prepare(`
      SELECT * FROM error_records WHERE student_id = ? AND subject = ? ORDER BY created_at DESC LIMIT ?
    `).all(sid, subject, n);
  } else {
    rows = db.prepare(`
      SELECT * FROM error_records WHERE student_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(sid, n);
  }
  return rows.map(rowToRecord);
}

// 删除错题
export function deleteErrorRecord(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM error_records WHERE id = ? AND student_id = ?').run(id, STUDENT_ID());
}

// 重做错题时更新掌握度
export function updateMastery(id: number, mastered: boolean): void {
  const db = getDb();
  const delta = mastered ? -20 : 10;
  db.prepare(`
    UPDATE error_records SET mastery = MAX(0, MIN(100, mastery + ?)) WHERE id = ?
  `).run(delta, id);
}
