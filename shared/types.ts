// 共享类型定义 - 前后端共用

// 学科
export type Subject = 'math' | 'physics' | 'chemistry';

export const SUBJECT_LABELS: Record<Subject, string> = {
  math: '数学',
  physics: '物理',
  chemistry: '化学',
};

// 诊断类型
export type DiagnosisType =
  | 'stuck'        // 卡壳中途
  | 'calc_error'   // 计算错误
  | 'logic_error'  // 逻辑错误
  | 'skip_step'    // 跳步
  | 'no_idea'      // 完全无思路
  | 'correct';     // 正确

// 诊断模式
export type AnalyzeMode = 'guide' | 'check';

// AI 诊断请求
export interface AnalyzeRequest {
  question: string;
  steps: string[];
  mode: AnalyzeMode;
  subject: Subject;
  // 图片base64(不含data:image前缀),有图片时走GLM-4V视觉模型
  image?: string;
}

// AI 诊断响应
export interface AnalyzeResponse {
  diagnosisType: DiagnosisType;
  errorStep?: number;
  coreError: string;
  guidance: string;
  knowledgePoints: string[];
  weakTags: string[];
  isCorrect: boolean;
  // AI 识别错误的逐步推理过程(先验证再下结论,让学生看到AI是怎么找出错的)
  reasoning?: string;
  // 图片模式下,AI从图片里识别出的电子版步骤(供前端展示并标注错误)
  recognizedSteps?: string[];
}

// 错题记录
export interface ErrorRecord {
  id: number;
  question: string;
  studentSteps: string[];
  diagnosisType: DiagnosisType;
  errorStep?: number;
  coreError: string;
  guidance: string;
  reasoning?: string;
  knowledgePoints: string[];
  tags: string[];
  subject: Subject;
  createdAt: string;
  mastery: number;
}

// 标签(含权重)
export interface TagWithWeight {
  name: string;
  weight: number;
  errorCount: number;
  subject: Subject;
  lastUpdated: string;
}

// 题目
export interface Question {
  id: number;
  content: string;
  answer: string;
  type: 'choice' | 'fill' | 'solve';
  options?: string[];
  knowledgePoints: string[];
  tags: string[];
  subject: Subject;
}

// 每日十题作答结果
export interface DailyResult {
  questionId: number;
  correct: boolean;
  userAnswer?: string; // 用户作答(做错时用于存入错题本)
}

export interface DailySubmit {
  results: DailyResult[];
}

// 每日十题完成报告
export interface DailyReport {
  total: number;
  correctCount: number;
  accuracy: number;
  knowledgePoints: string[];
  tagChanges: { name: string; delta: number; newWeight: number }[];
}

// 学生画像
export interface ProfileData {
  totalSolved: number;
  totalErrors: number;
  streakDays: number;
  masteryMap: { chapter: string; mastery: number; total: number; mastered: number }[];
  weakTags: { name: string; weight: number }[];
}
