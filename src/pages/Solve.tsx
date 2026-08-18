import { useEffect, useState } from "react";
import { Lightbulb, CheckCheck, Loader2, Plus, X, ChevronDown, BookText, RotateCcw } from "lucide-react";
import { analyzeSolution, getQuestions } from "@/lib/api";
import DiagnosisCard from "@/components/DiagnosisCard";
import SubjectSwitcher from "@/components/SubjectSwitcher";
import { useSubjectStore } from "@/store/subject";
import { SUBJECT_LABELS } from "@/types";
import type { AnalyzeResponse, Question } from "@/types";
import { cn } from "@/lib/utils";

export default function Solve() {
  const { subject } = useSubjectStore();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQ, setSelectedQ] = useState<Question | null>(null);
  const [customQuestion, setCustomQuestion] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const [steps, setSteps] = useState<string[]>([""]);
  const [diagnosis, setDiagnosis] = useState<AnalyzeResponse | null>(null);
  const [aiEnabled, setAiEnabled] = useState<boolean | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getQuestions(subject).then(setQuestions).catch(console.error);
    // 切换学科时清空当前选择与诊断,避免跨科数据混淆
    setSelectedQ(null);
    setCustomQuestion("");
    reset();
  }, [subject]);

  const currentQuestion = selectedQ?.content || customQuestion;

  const handleAnalyze = async (mode: "guide" | "check") => {
    if (!currentQuestion.trim()) {
      setError("请先选择或输入题目");
      return;
    }
    const validSteps = steps.filter(s => s.trim());
    if (mode === "check" && validSteps.length === 0) {
      setError("请先写出你的解题步骤");
      return;
    }
    setError("");
    setLoading(true);
    setDiagnosis(null);

    try {
      const result = await analyzeSolution({
        question: currentQuestion,
        steps: validSteps,
        mode,
        subject,
      });
      setDiagnosis(result.diagnosis);
      setAiEnabled(result.aiEnabled);
      setSaved(!!result.errorRecord);
    } catch (err: any) {
      setError(err.message || "诊断失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSteps([""]);
    setDiagnosis(null);
    setSaved(false);
    setError("");
  };

  const questionText = currentQuestion;

  return (
    <div className="px-5 pt-12 pb-6 space-y-5">
      <header>
        <h1 className="text-2xl font-serif font-bold text-ink-700">{SUBJECT_LABELS[subject]}解题练习</h1>
        <p className="text-sm text-ink-400 mt-0.5">AI {SUBJECT_LABELS[subject]}教师将审阅你的解题步骤，给指导不给答案</p>
      </header>

      <SubjectSwitcher />

      {/* 题目区 */}
      <section className="rounded-2xl bg-paper-50 border border-ink-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-ink-50 bg-ink-50/50">
          <div className="flex items-center gap-1.5">
            <BookText size={15} className="text-ink-500" />
            <span className="text-xs font-semibold text-ink-500">题目</span>
          </div>
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="text-xs text-ink-400 flex items-center gap-1 hover:text-ink-600"
          >
            {showPicker ? "收起" : "从题库选择"} <ChevronDown size={14} className={cn("transition-transform", showPicker && "rotate-180")} />
          </button>
        </div>

        {showPicker && (
          <div className="max-h-48 overflow-y-auto border-b border-ink-50 divide-y divide-ink-50">
            {questions.map(q => (
              <button
                key={q.id}
                onClick={() => { setSelectedQ(q); setCustomQuestion(""); setShowPicker(false); reset(); }}
                className={cn(
                  "w-full text-left px-4 py-2.5 text-sm hover:bg-ink-50/50 transition-colors",
                  selectedQ?.id === q.id ? "bg-ink-50 text-ink-700 font-medium" : "text-ink-600"
                )}
              >
                {q.content}
              </button>
            ))}
          </div>
        )}

        <div className="px-4 py-3">
          {selectedQ ? (
            <p className="font-serif text-base text-ink-700 leading-relaxed">{selectedQ.content}</p>
          ) : (
            <textarea
              value={customQuestion}
              onChange={e => { setCustomQuestion(e.target.value); reset(); }}
              placeholder="输入题目内容，例如：解方程 2x - 5 = 3"
              className="w-full bg-transparent text-base font-serif text-ink-700 placeholder:text-ink-200 resize-none min-h-[60px]"
              rows={2}
            />
          )}
        </div>
      </section>

      {/* 解题步骤区 - 横线本风格 */}
      <section className="rounded-2xl bg-paper-50 border border-ink-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-ink-50 bg-ink-50/50">
          <span className="text-xs font-semibold text-ink-500">我的解题步骤</span>
          <span className="text-xs text-ink-300">{steps.filter(s => s.trim()).length} 步</span>
        </div>
        <div className="notebook-lines px-4 py-2 min-h-[140px]">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2 group" style={{ minHeight: "36px" }}>
              <span
                className={cn(
                  "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold mt-1.5 transition-colors",
                  diagnosis?.errorStep === i + 1
                    ? "bg-pen-500 text-white animate-pulseSoft"
                    : "bg-ink-100 text-ink-500"
                )}
              >
                {i + 1}
              </span>
              <textarea
                value={step}
                onChange={e => {
                  const next = [...steps];
                  next[i] = e.target.value;
                  setSteps(next);
                }}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey && i === steps.length - 1 && step.trim()) {
                    e.preventDefault();
                    setSteps([...steps, ""]);
                  }
                }}
                placeholder={i === 0 ? "开始写第一步..." : "继续..."}
                rows={1}
                className="flex-1 bg-transparent text-sm text-ink-700 placeholder:text-ink-200 resize-none py-1.5 leading-[33px]"
                style={{ height: "auto", minHeight: "36px" }}
                onInput={e => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = "auto";
                  t.style.height = t.scrollHeight + "px";
                }}
              />
              {steps.length > 1 && (
                <button
                  onClick={() => setSteps(steps.filter((_, idx) => idx !== i))}
                  className="flex-shrink-0 mt-1.5 p-1 text-ink-200 hover:text-pen-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setSteps([...steps, ""])}
            className="flex items-center gap-1 mt-1 ml-7 text-xs text-ink-300 hover:text-ink-500"
          >
            <Plus size={13} /> 添加步骤
          </button>
        </div>
      </section>

      {/* 操作按钮 */}
      <div className="flex gap-3">
        <button
          onClick={() => handleAnalyze("guide")}
          disabled={loading}
          className="flex-1 rounded-pill bg-amber/15 text-amber border border-amber/30 py-3 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-amber/25 transition-colors disabled:opacity-50"
        >
          <Lightbulb size={17} />
          思路指导
        </button>
        <button
          onClick={() => handleAnalyze("check")}
          disabled={loading}
          className="flex-1 rounded-pill bg-ink-700 text-white py-3 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-ink-600 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={17} className="animate-spin" /> : <CheckCheck size={17} />}
          检查纠错
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="rounded-xl bg-pen-50 border border-pen-100 px-4 py-2.5 text-sm text-pen-600">
          {error}
        </div>
      )}

      {/* 加载中 */}
      {loading && (
        <div className="rounded-2xl bg-paper-50 border border-ink-100 px-4 py-8 flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-ink-400" />
          <p className="text-sm text-ink-400">AI 教师正在审阅你的解题步骤...</p>
        </div>
      )}

      {/* 诊断结果 */}
      {diagnosis && !loading && (
        <div className="space-y-3">
          {saved && !diagnosis.isCorrect && (
            <div className="flex items-center gap-2 rounded-xl bg-sage-50 border border-sage-100 px-4 py-2 text-xs text-sage-700">
              <span className="font-semibold">✓ 已自动存入错题本</span>
              <span className="text-sage-500">薄弱标签已更新</span>
            </div>
          )}
          <DiagnosisCard diagnosis={diagnosis} aiEnabled={aiEnabled} />
          <button
            onClick={reset}
            className="w-full rounded-pill border border-ink-200 text-ink-500 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-ink-50 transition-colors"
          >
            <RotateCcw size={15} />
            重新作答
          </button>
        </div>
      )}
    </div>
  );
}
