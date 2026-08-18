/**
 * 每日十题服务 - 基于薄弱标签权重的自适应出题
 * 配比: 70% 薄弱标签题 + 20% 复习题 + 10% 新题
 * 按学科出题,标签权重也在同学科内计算
 * 做错的题自动写入错题本(无 AI 诊断,用题目自带知识点/标签填充)
 */
import { getDb } from '../db.js';
import { getTagWeightMap, decreaseTagWeights, increaseTagWeights } from './tag-service.js';
import { addErrorRecord } from './notebook-service.js';
import type { Question, DailyReport, AnalyzeResponse, Subject } from '../../shared/types.js';

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

function getAllQuestions(subject?: Subject): Question[] {
  const db = getDb();
  let rows: any[];
  if (subject) {
    rows = db.prepare('SELECT * FROM questions WHERE subject = ?').all(subject);
  } else {
    rows = db.prepare('SELECT * FROM questions').all();
  }
  return rows.map(rowToQuestion);
}

// 加权随机抽样:根据标签权重为题目打分,按分数加权抽取
function weightedSample(questions: Question[], weights: Map<string, number>, count: number): Question[] {
  if (questions.length <= count) return [...questions];

  // 为每道题计算权重:取其标签中最高权重 + 基础分
  const scored = questions.map(q => {
    const maxTagWeight = Math.max(0, ...q.tags.map(t => weights.get(t) || 0));
    // 标签权重越高,该题被选中概率越大;无标签题给基础分 10
    const score = maxTagWeight > 0 ? maxTagWeight + 10 : 10;
    return { q, score };
  });

  const result: Question[] = [];
  const pool = [...scored];

  for (let i = 0; i < count && pool.length > 0; i++) {
    const totalScore = pool.reduce((sum, p) => sum + p.score, 0);
    let rand = Math.random() * totalScore;
    let idx = 0;
    for (let j = 0; j < pool.length; j++) {
      rand -= pool[j].score;
      if (rand <= 0) { idx = j; break; }
      idx = j;
    }
    result.push(pool[idx].q);
    pool.splice(idx, 1);
  }

  return result;
}

// 生成今日 10 题(按学科)
export function generateDailyQuestions(subject: Subject, count = 10): Question[] {
  const allQuestions = getAllQuestions(subject);
  const weights = getTagWeightMap(subject);

  // 按标签是否命中权重分组
  const weakQuestions = allQuestions.filter(q =>
    q.tags.some(t => (weights.get(t) || 0) > 0)
  );
  const otherQuestions = allQuestions.filter(q =>
    !q.tags.some(t => (weights.get(t) || 0) > 0)
  );

  // 配比: 70% 薄弱题, 20% 复习/其他, 10% 新题(同 otherQuestions)
  const weakCount = Math.min(Math.ceil(count * 0.7), weakQuestions.length);
  const remainCount = count - weakCount;

  const weakPicked = weightedSample(weakQuestions, weights, weakCount);
  const otherPicked = weightedSample(otherQuestions, weights, remainCount);

  // 打乱顺序
  const combined = [...weakPicked, ...otherPicked];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  // 不足 count 题则从全量补
  if (combined.length < count) {
    const used = new Set(combined.map(q => q.id));
    for (const q of allQuestions) {
      if (combined.length >= count) break;
      if (!used.has(q.id)) combined.push(q);
    }
  }

  return combined.slice(0, count);
}

// 提交每日十题结果,更新标签权重(按学科),做错的题写入错题本
export function submitDailyResults(
  results: { questionId: number; correct: boolean; userAnswer?: string }[],
  subject: Subject,
): DailyReport {
  const allQuestions = getAllQuestions(subject);
  const qMap = new Map(allQuestions.map(q => [q.id, q]));

  const wrongTags = new Set<string>();
  const correctTags = new Set<string>();
  let correctCount = 0;
  const knowledgePoints = new Set<string>();

  for (const r of results) {
    const q = qMap.get(r.questionId);
    if (!q) continue;
    q.knowledgePoints.forEach(kp => knowledgePoints.add(kp));
    if (r.correct) {
      correctCount++;
      q.tags.forEach(t => correctTags.add(t));
    } else {
      q.tags.forEach(t => wrongTags.add(t));
      // 做错的题写入错题本(无 AI 诊断,用题目信息构造简化诊断)
      const diagnosis: AnalyzeResponse = {
        diagnosisType: 'calc_error',
        coreError: `每日十题作答错误，你的答案：${r.userAnswer || '（未作答）'}`,
        guidance: `正确答案：${q.answer}。建议回顾相关知识点后重新练习。`,
        knowledgePoints: q.knowledgePoints,
        weakTags: q.tags,
        isCorrect: false,
      };
      addErrorRecord(q.content, [r.userAnswer || '（未作答）'], diagnosis, subject);
    }
  }

  // 错误的标签增强权重(同学科)
  if (wrongTags.size > 0) {
    increaseTagWeights([...wrongTags], subject);
  }
  // 正确的标签减弱权重(同学科)
  let tagChanges: { name: string; delta: number; newWeight: number }[] = [];
  if (correctTags.size > 0) {
    tagChanges = decreaseTagWeights([...correctTags], subject);
  }

  return {
    total: results.length,
    correctCount,
    accuracy: results.length > 0 ? correctCount / results.length : 0,
    knowledgePoints: [...knowledgePoints],
    tagChanges,
  };
}
