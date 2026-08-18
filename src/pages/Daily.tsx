import { useEffect, useState, useRef } from "react";
import { generateDaily, submitDaily, ocrCheckAnswer } from "@/lib/api";
import SubjectSwitcher from "@/components/SubjectSwitcher";
import { useSubjectStore } from "@/store/subject";
import { SUBJECT_LABELS } from "@/types";
import type { Question, DailyReport } from "@/types";
import { cn } from "@/lib/utils";
import { CalendarCheck, Loader2, Check, X, Trophy, TrendingUp, TrendingDown, RotateCcw, Camera, Image as ImageIcon } from "lucide-react";

export default function Daily() {
  const { subject } = useSubjectStore();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  // 图片判分模式:用 GLM-4V 直接判对错,绕过前端 checkAnswer
  const [imageChecked, setImageChecked] = useState<Record<number, boolean>>({});
  const [report, setReport] = useState<DailyReport | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 拍照相关
  const [ocrLoading, setOcrLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<Record<number, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    setAnswers({});
    setRevealed({});
    setImageChecked({});
    setImagePreview({});
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
    if (normalized === correctNorm) return true;
    if (correctNorm.length === 1 && /^[a-z]$/.test(correctNorm)) {
      return normalized.charAt(0) === correctNorm;
    }
    if (correctNorm.length <= 4 || /^\d+(\.\d+)?%?$/.test(correctNorm)) {
      return false;
    }
    if (normalized.length >= correctNorm.length * 0.6) {
      return correctNorm.includes(normalized) || normalized.includes(correctNorm);
    }
    return false;
  };

  // 图片压缩(与 Solve 页一致,1280px / JPEG 0.7)
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const MAX_WIDTH = 1280;
          let { width, height } = img;
          if (width > MAX_WIDTH) {
            height = Math.round(height * (MAX_WIDTH / width));
            width = MAX_WIDTH;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('canvas 不可用')); return; }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl.split(',')[1]);
        };
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  };

  // 拍照判分:一次 GLM-4V 调用完成 OCR + 判对错
  const handleImageCheck = async (file: File | undefined) => {
    if (!file || !q) return;
    if (!file.type.startsWith('image/')) return;
    setOcrLoading(true);
    try {
      const base64 = await compressImage(file);
      setImagePreview({ ...imagePreview, [q.id]: `data:image/jpeg;base64,${base64}` });
      const result = await ocrCheckAnswer({
        image: base64,
        question: q.content,
        correctAnswer: q.answer,
        subject,
      });
      // 把识别出的答案填入答案框,标记为图片判分模式
      setAnswers({ ...answers, [q.id]: result.recognizedAnswer || "(图片未识别出答案)" });
      setImageChecked({ ...imageChecked, [q.id]: result.isCorrect });
      setRevealed({ ...revealed, [q.id]: true });
    } catch (err: any) {
      console.error(err);
      alert("图片判分失败: " + err.message);
    } finally {
      setOcrLoading(false);
    }
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
    const results = questions.map(qq => {
      // 图片判分的题用 AI 判定的结果,其他用前端 checkAnswer
      const usedImage = imageChecked[qq.id] !== undefined;
      const correct = usedImage
        ? imageChecked[qq.id]
        : checkAnswer(qq.id, answers[qq.id] || "", qq.answer);
      return {
        questionId: qq.id,
        correct,
        userAnswer: answers[qq.id] || "",
      };
    });
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
    setImageChecked({});
    setImagePreview({});
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
  // 图片判分的题用 imageChecked 的结果,其他用 checkAnswer
  const usedImageCheck = imageChecked[q.id] !== undefined;
  const isCorrect = usedImageCheck
    ? imageChecked[q.id]
    : checkAnswer(q.id, answers[q.id] || "", q.answer);

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
          <>
            <textarea
              value={answers[q.id] || ""}
              onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
              disabled={isRevealed}
              placeholder="写出你的答案,或点击下方拍照让AI识别..."
              className="w-full rounded-xl border border-ink-100 px-4 py-3 text-sm text-ink-700 placeholder:text-ink-200 resize-none focus:border-ink-400"
              rows={q.type === "fill" ? 1 : 3}
            />
            {/* 拍照按钮(未提交时显示) */}
            {!isRevealed && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={ocrLoading}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-pill bg-ink-50 text-ink-600 hover:bg-ink-100 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {ocrLoading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                  {ocrLoading ? "AI识别中..." : "拍照判分"}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={ocrLoading}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-pill bg-ink-50 text-ink-600 hover:bg-ink-100 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <ImageIcon size={14} />
                </button>
              </div>
            )}
            {/* 已拍照的图片预览 */}
            {imagePreview[q.id] && (
              <img src={imagePreview[q.id]} alt="我的答案" className="mt-2 w-full max-h-48 object-contain rounded-lg border border-ink-100 bg-white" />
            )}
          </>
        )}

        {/* 揭示答案 */}
        {isRevealed && (
          <div className={cn(
            "mt-4 rounded-xl p-3 flex items-start gap-2 animate-fadeInUp",
            isCorrect ? "bg-sage-50" : "bg-pen-50"
          )}>
            {isCorrect ? <Check size={18} className="text-sage-500 mt-0.5" /> : <X size={18} className="text-pen-500 mt-0.5" />}
            <div className="flex-1">
              <p className={cn("text-sm font-semibold", isCorrect ? "text-sage-700" : "text-pen-700")}>
                {isCorrect ? "回答正确！" : "回答错误"}
                {usedImageCheck && <span className="ml-1 text-xs font-normal text-ink-400">(AI图片判分)</span>}
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
            disabled={!answers[q.id]?.trim() || ocrLoading}
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

      {/* 隐藏的文件输入 */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => handleImageCheck(e.target.files?.[0])}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => handleImageCheck(e.target.files?.[0])}
      />
    </div>
  );
}
