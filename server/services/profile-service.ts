/**
 * 学生画像服务 - 学习数据统计与掌握度分析
 * 可按学科过滤统计
 */
import { getDb } from '../db.js';
import { getCurrentStudentId } from '../lib/context.js';
import { getAllTags } from './tag-service.js';
import type { ProfileData, Subject } from '../../shared/types.js';

const STUDENT_ID = () => getCurrentStudentId();

export function getProfile(subject?: Subject): ProfileData {
  const db = getDb();
  const sid = STUDENT_ID();

  // 解题总数
  const solvedRow = subject
    ? db.prepare('SELECT COUNT(*) as c FROM solution_records WHERE student_id = ? AND subject = ?').get(sid, subject) as { c: number }
    : db.prepare('SELECT COUNT(*) as c FROM solution_records WHERE student_id = ?').get(sid) as { c: number };
  const totalSolved = solvedRow.c;

  // 错题总数
  const errorRow = subject
    ? db.prepare('SELECT COUNT(*) as c FROM error_records WHERE student_id = ? AND subject = ?').get(sid, subject) as { c: number }
    : db.prepare('SELECT COUNT(*) as c FROM error_records WHERE student_id = ?').get(sid) as { c: number };
  const totalErrors = errorRow.c;

  // 连续学习天数
  const studentRow = db.prepare('SELECT streak_days FROM students WHERE id = ?').get(sid) as { streak_days: number };
  const streakDays = studentRow?.streak_days || 0;

  // 掌握度地图:按章节统计
  const allTags = getAllTags(subject);
  const tagWeightMap = new Map(allTags.map(t => [t.name, t.weight]));

  // 从题库获取所有章节(通过知识点,可按学科过滤)
  const questions = subject
    ? db.prepare('SELECT knowledge_points, tags FROM questions WHERE subject = ?').all(subject) as any[]
    : db.prepare('SELECT knowledge_points, tags FROM questions').all() as any[];

  // 按知识点章节聚合
  const chapterStats = new Map<string, { total: number; mastered: number }>();

  for (const q of questions) {
    const kps = JSON.parse(q.knowledge_points || '[]') as string[];
    for (const kp of kps) {
      const chapter = kp;
      const stat = chapterStats.get(chapter) || { total: 0, mastered: 0 };
      stat.total++;
      // 检查该题的标签是否都已消除(权重为0或不存在)
      const tags = JSON.parse(q.tags || '[]') as string[];
      const allMastered = tags.every(t => !tagWeightMap.has(t) || (tagWeightMap.get(t) || 0) === 0);
      if (allMastered) stat.mastered++;
      chapterStats.set(chapter, stat);
    }
  }

  const masteryMap = [...chapterStats.entries()].map(([chapter, stat]) => ({
    chapter,
    total: stat.total,
    mastered: stat.mastered,
    mastery: stat.total > 0 ? Math.round((stat.mastered / stat.total) * 100) : 0,
  }));

  // 薄弱标签(权重 > 0)
  const weakTags = allTags
    .filter(t => t.weight > 0)
    .map(t => ({ name: t.name, weight: t.weight }));

  return {
    totalSolved,
    totalErrors,
    streakDays,
    masteryMap,
    weakTags,
  };
}

// 更新连续学习天数(每次有活动时调用)
export function updateStreak(): void {
  const db = getDb();
  const sid = STUDENT_ID();
  const today = new Date().toDateString();
  const row = db.prepare('SELECT last_active, streak_days FROM students WHERE id = ?').get(sid) as any;

  if (!row) return;
  const lastActive = row.last_active ? new Date(row.last_active).toDateString() : null;

  if (lastActive === today) return; // 今天已记录

  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const newStreak = lastActive === yesterday ? (row.streak_days || 0) + 1 : 1;

  db.prepare('UPDATE students SET streak_days = ?, last_active = ? WHERE id = ?')
    .run(newStreak, new Date().toISOString(), sid);
}
