/**
 * 标签权重服务 - 薄弱标签的自适应权重管理
 * 连错 +15(上限100),做对 -20(下限0,归零移除)
 * 标签按学科隔离,同一名称在不同学科是独立标签
 */
import { getDb, ensureDefaultStudent, transaction } from '../db.js';
import type { TagWithWeight, Subject } from '../../shared/types.js';

const STUDENT_ID = () => ensureDefaultStudent();

// 确保标签存在(按学科隔离),返回 tag_id
function ensureTag(name: string, subject: Subject): number {
  const db = getDb();
  let row = db.prepare('SELECT id FROM tags WHERE name = ? AND subject = ?').get(name, subject) as { id: number } | undefined;
  if (!row) {
    const info = db.prepare('INSERT INTO tags (name, subject) VALUES (?, ?)').run(name, subject);
    row = { id: Number(info.lastInsertRowid) };
  }
  return row.id;
}

// 获取学生所有标签及权重(可按学科过滤)
export function getAllTags(subject?: Subject): TagWithWeight[] {
  const db = getDb();
  const sid = STUDENT_ID();
  let rows: any[];
  if (subject) {
    rows = db.prepare(`
      SELECT t.name, t.subject, st.weight, st.error_count, st.last_updated
      FROM student_tags st
      JOIN tags t ON st.tag_id = t.id
      WHERE st.student_id = ? AND t.subject = ?
      ORDER BY st.weight DESC
    `).all(sid, subject);
  } else {
    rows = db.prepare(`
      SELECT t.name, t.subject, st.weight, st.error_count, st.last_updated
      FROM student_tags st
      JOIN tags t ON st.tag_id = t.id
      WHERE st.student_id = ?
      ORDER BY st.weight DESC
    `).all(sid);
  }

  return rows.map(r => ({
    name: r.name,
    subject: r.subject as Subject,
    weight: r.weight,
    errorCount: r.error_count,
    lastUpdated: r.last_updated,
  }));
}

// 获取权重最高的 N 个标签(可按学科)
export function getTopWeakTags(n: number, subject?: Subject): TagWithWeight[] {
  return getAllTags(subject).slice(0, n);
}

// 学生在某题出错时,增强相关标签权重(+15)
export function increaseTagWeights(tagNames: string[], subject: Subject): void {
  const db = getDb();
  const sid = STUDENT_ID();
  const now = new Date().toISOString();

  const upsert = db.prepare(`
    INSERT INTO student_tags (student_id, tag_id, weight, error_count, last_updated)
    VALUES (?, ?, 65, 2, ?)
    ON CONFLICT(student_id, tag_id)
    DO UPDATE SET weight = MIN(100, weight + 15), error_count = error_count + 1, last_updated = ?
  `);

  transaction(() => {
    for (const name of tagNames) {
      const tagId = ensureTag(name, subject);
      upsert.run(sid, tagId, now, now);
    }
  });
}

// 学生做对时,减弱相关标签权重(-20,归零则移除)
export function decreaseTagWeights(tagNames: string[], subject: Subject): { name: string; delta: number; newWeight: number }[] {
  const db = getDb();
  const sid = STUDENT_ID();
  const now = new Date().toISOString();
  const changes: { name: string; delta: number; newWeight: number }[] = [];

  const getCurrent = db.prepare(`
    SELECT st.weight, st.id FROM student_tags st
    JOIN tags t ON st.tag_id = t.id
    WHERE st.student_id = ? AND t.name = ? AND t.subject = ?
  `);

  const update = db.prepare(`
    UPDATE student_tags SET weight = ?, error_count = 0, last_updated = ? WHERE id = ?
  `);
  const remove = db.prepare('DELETE FROM student_tags WHERE id = ?');

  transaction(() => {
    for (const name of tagNames) {
      const row = getCurrent.get(sid, name, subject) as { weight: number; id: number } | undefined;
      if (!row) continue;
      const newWeight = row.weight - 20;
      if (newWeight <= 0) {
        remove.run(row.id);
        changes.push({ name, delta: -row.weight, newWeight: 0 });
      } else {
        update.run(newWeight, now, row.id);
        changes.push({ name, delta: -20, newWeight });
      }
    }
  });

  return changes;
}

// 获取标签权重映射(用于每日十题抽样,按学科)
export function getTagWeightMap(subject: Subject): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of getAllTags(subject)) {
    map.set(t.name, t.weight);
  }
  return map;
}
