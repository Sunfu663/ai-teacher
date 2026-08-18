import { useEffect, useState } from "react";
import { generateDaily, submitDaily } from "@/lib/api";
import SubjectSwitcher from "@/components/SubjectSwitcher";
import { useSubjectStore } from "@/store/subject";
import { SUBJECT_LABELS } from "@/types";
import type { Question, DailyReport } from "@/types";
import { cn } from "@/lib/utils";
import { CalendarCheck, Loader2, Check, X, Trophy, TrendingUp, TrendingDown, RotateCcw } from "lucide-react";

export default function Daily() {
  const { subject } = useSubjectStore();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [report, setReport] = useState<DailyReport | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setAnswers({});
    setRevealed({});
    setReport(null);
    setCurrent(0);
    generateDaily(subject, 10)
      .then(qs => { setQuestions(qs); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); });
  }, [subject]);

  const q = questions[current];

  const checkAnswer = (qid: number, answer: string, correct: string) => {
    const normalized = answer.trim().replace(/\s/g, "").toLowerCase();
    const correctNorm = correct.trim().replace(/\s/g, "").toLowerCase();
    if (!normalized) return false;
    // 完全匹配
    if (normalized === correctNorm) return true;
    // 选择题: answer 可能是单字母 "C", 用户点选存的是完整选项 "C. 蜡烛燃烧"
    // 提取用户选项首字母与 answer 比较
    if (correctNorm.length === 1 && /^[a-z]$/.test(correctNorm)) {
      return normalized.charAt(0) === correctNorm;
    }
    // 数字/短答案(<=4字符或纯数字): 必须严格相等
    // 避免 "4" 匹配 "44"、"2" 匹配 "2H₂O" 这类误判
    if (correctNorm.length <= 4 || /^\d+(\.\d+)?%?$/.test(correctNorm)) {
      return false;
    }
    // 长答案(方程式/句子): 允许包含匹配,但用户答案长度不能过短
    // 要求至少达到正确答案长度的 60%,避免输入片段就判对
    if (normalized.length >= correctNorm.length * 0.6) {
      return correctNorm.includes(normalized) || normalized.includes(correctNorm);
    }
    return false;
  };

  const handleReveal = () => {
    if (!q) return;
    setRevealed({ ...revealed, [q.id]: true });
  };

  const handleNext = () => {
    if (current < questions.length - 1) {
      setCurrent(current + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const results = questions.map(qq => ({
      questionId: qq.id,
      correct: checkAnswer(qq.id, answers[qq.id] || "", qq.answer),
      userAnswer: answers[qq.id] || "",
    }));
    try {
      const r = await submitDaily(subject, results);
      setReport(r);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    setLoading(true);
    setAnswers({});
    setRevealed({});
    setReport(null);
    setCurrent(0);
    generateDaily(subject, 10).then(qs => { setQuestions(qs); setLoading(false); });
  };

  // 加载中
  if (loading) {
    return (
      <div className="px-5 pt-12 pb-6">
        <div className="mb-4"><SubjectSwitcher /></div>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <Loader2 size={28} className="animate-spin text-ink-400" />
          <p className="text-sm text-ink-400">正在为你生成{SUBJECT_LABELS[subject]}今日十题...</p>
        </div>
      </div>
    );
  }

  // 完成报告
  if (report) {
    const correctRate = Math.round(report.accuracy * 100);
    return (
      <div className="px-5 pt-12 pb-6 space-y-5">
        <div className="mb-1"><SubjectSwitcher /></div>
        <div className="text-center py-4">
          <div className={cn(
            "inline-flex p-4 rounded-full mb-3",
            correctRate >= 80 ? "bg-sage-50" : correctRate >= 50 ? "bg-amber/10" : "bg-pen-50"
          )}>
            <Trophy size={36} className={correctRate >= 80 ? "text-sage-500" : correctRate >= 50 ? "text-amber" : "text-pen-500"} />
          </div>
          <h1 className="text-2xl font-serif font-bold text-ink-700">{SUBJECT_LABELS[subject]}练习完成</h1>
          <p className="text-3xl font-serif font-bold mt-2 text-ink-700">
            {report.correctCount}<span className="text-lg text-ink-300">/{report.total}</span>
          </p>
          <p className="text-sm text-ink-400">正确率 {correctRate}%</p>
        </div>

        {/* 标签权重变化 */}
        {report.tagChanges.length > 0 && (
          <div className="rounded-2xl bg-paper-50 border border-ink-100 p-4">
            <h3 className="text-sm font-semibold text-ink-700 mb-3">薄弱标签变化</h3>
            <div className="space-y-2">
              {report.tagChanges.map((c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-ink-600">{c.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-300">权重 {c.newWeight || "已移除"}</span>
                    <span className={cn(
                      "flex items-center gap-0.5 text-xs font-bold",
                      c.delta < 0 ? "text-sage-600" : "text-pen-600"
                    )}>
                      {c.delta < 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                      {c.delta > 0 ? `+${c.delta}` : c.delta}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.tagChanges.length === 0 && (
          <div className="rounded-2xl bg-sage-50 border border-sage-100 p-4 text-center">
            <p className="text-sm text-sage-700">本次练习全部正确，继续保持！</p>
          </div>
        )}

        <button
          onClick={restart}
          className="w-full rounded-pill bg-ink-700 text-white py-3 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-ink-600 transition-colors"
        >
          <RotateCcw size={16} />
          再练一组
        </button>
      </div>
    );
  }

  // 答题中
  if (!q) return null;
  const isRevealed = revealed[q.id];
  const isCorrect = checkAnswer(q.id, answers[q.id] || "", q.answer);

  return (
    <div className="px-5 pt-12 pb-6 space-y-5">
      {/* 学科切换 */}
      <SubjectSwitcher />

      {/* 顶部进度 */}
      <header>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-serif font-bold text-ink-700">{SUBJECT_LABELS[subject]}每日十题</h1>
          <span className="text-sm text-ink-400">{current + 1} / {questions.length}</span>
        </div>
        <div className="h-1.5 rounded-full bg-ink-50 overflow-hidden">
          <div
            className="h-full rounded-full bg-ink-600 transition-all duration-300"
            style={{ width: `${((current + 1) / questions.length) * 100}%` }}
          />
        </div>
      </header>

      {/* 题目卡 */}
      <section className="rounded-2xl bg-paper-50 border border-ink-100 p-5 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          {q.knowledgePoints.map((kp, i) => (
            <span key={i} className="text-xs px-2 py-0.5 rounded bg-ink-50 text-ink-500">{kp}</span>
          ))}
        </div>
        <p className="font-serif text-lg text-ink-700 leading-relaxed mb-5">{q.content}</p>

        {/* 选择题 */}
        {q.type === "choice" && q.options && (
          <div className="space-y-2">
            {q.options.map((opt, i) => (
              <button
                key={i}
                disabled={isRevealed}
                onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                className={cn(
                  "w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-all",
                  answers[q.id] === opt
                    ? "border-ink-500 bg-ink-50 text-ink-700 font-medium"
                    : "border-ink-100 text-ink-600 hover:border-ink-300",
                  isRevealed && opt === q.answer && "border-sage-400 bg-sage-50 text-sage-700",
                  isRevealed && answers[q.id] === opt && opt !== q.answer && "border-pen-400 bg-pen-50 text-pen-700"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* 填空/解答题 */}
        {q.type !== "choice" && (
          <textarea
            value={answers[q.id] || ""}
            onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
            disabled={isRevealed}
            placeholder="写出你的答案..."
            className="w-full rounded-xl border border-ink-100 px-4 py-3 text-sm text-ink-700 placeholder:text-ink-200 resize-none focus:border-ink-400"
            rows={q.type === "fill" ? 1 : 3}
          />
        )}

        {/* 揭示答案 */}
        {isRevealed && (
          <div className={cn(
            "mt-4 rounded-xl p-3 flex items-start gap-2 animate-fadeInUp",
            isCorrect ? "bg-sage-50" : "bg-pen-50"
          )}>
            {isCorrect ? <Check size={18} className="text-sage-500 mt-0.5" /> : <X size={18} className="text-pen-500 mt-0.5" />}
            <div>
              <p className={cn("text-sm font-semibold", isCorrect ? "text-sage-700" : "text-pen-700")}>
                {isCorrect ? "回答正确！" : "回答错误"}
              </p>
              {!isCorrect && (
                <p className="text-sm text-ink-600 mt-0.5">正确答案：<span className="font-mono font-medium">{q.answer}</span></p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 操作按钮 */}
      <div className="flex gap-3">
        {!isRevealed ? (
          <button
            onClick={handleReveal}
            disabled={!answers[q.id]?.trim()}
            className="flex-1 rounded-pill bg-ink-700 text-white py-3 text-sm font-semibold disabled:opacity-40 hover:bg-ink-600 transition-colors"
          >
            提交答案
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={submitting}
            className="flex-1 rounded-pill bg-ink-700 text-white py-3 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-ink-600 transition-colors"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            {current < questions.length - 1 ? "下一题" : "查看结果"}
          </button>
        )}
      </div>
    </div>
  );
}
