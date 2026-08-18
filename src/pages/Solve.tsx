import { useEffect, useState, useRef } from "react";
import { Lightbulb, CheckCheck, Loader2, Plus, X, ChevronDown, BookText, RotateCcw, Camera, Image as ImageIcon, FileText } from "lucide-react";
import { analyzeSolution, getQuestions } from "@/lib/api";
import DiagnosisCard from "@/components/DiagnosisCard";
import SubjectSwitcher from "@/components/SubjectSwitcher";
import { useSubjectStore } from "@/store/subject";
import { SUBJECT_LABELS } from "@/types";
import type { AnalyzeResponse, Question } from "@/types";
import { cn } from "@/lib/utils";

type InputMode = "text" | "image";

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

  // 图片模式相关
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [imagePreview, setImagePreview] = useState<string>("");
  const [imageBase64, setImageBase64] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getQuestions(subject).then(setQuestions).catch(console.error);
    // 切换学科时清空当前选择与诊断,避免跨科数据混淆
    setSelectedQ(null);
    setCustomQuestion("");
    reset();
  }, [subject]);

  const currentQuestion = selectedQ?.content || customQuestion;

  // 图片压缩:用 canvas 把图片压到 1280px 宽,JPEG 0.7 质量
  // 控制 base64 体积,提升 GLM-4V 调用速度
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
          // 返回不含 data:image/jpeg;base64, 前缀的纯 base64
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

  const handleImageSelect = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }
    setError("");
    try {
      const base64 = await compressImage(file);
      setImageBase64(base64);
      setImagePreview(`data:image/jpeg;base64,${base64}`);
      setInputMode("image");
      // 切到图片模式时清空之前的诊断
      setDiagnosis(null);
      setSaved(false);
    } catch (err: any) {
      setError(err.message || '图片处理失败');
    }
  };

  const handleAnalyze = async (mode: "guide" | "check") => {
    if (!currentQuestion.trim()) {
      setError("请先选择或输入题目");
      return;
    }
    const validSteps = steps.filter(s => s.trim());
    if (inputMode === "text" && mode === "check" && validSteps.length === 0) {
      setError("请先写出你的解题步骤，或切换到拍照模式");
      return;
    }
    if (inputMode === "image" && !imageBase64) {
      setError("请先拍照或上传解题步骤图片");
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
        image: inputMode === "image" ? imageBase64 : undefined,
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
    setImagePreview("");
    setImageBase64("");
  };

  // 切换输入模式
  const switchMode = (m: InputMode) => {
    setInputMode(m);
    setDiagnosis(null);
    setSaved(false);
    setError("");
  };

  // 诊断完成后,显示的步骤列表(文本模式用用户输入,图片模式用AI识别结果)
  const displaySteps = diagnosis?.recognizedSteps && diagnosis.recognizedSteps.length > 0
    ? diagnosis.recognizedSteps
    : steps.filter(s => s.trim());

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

      {/* 输入模式切换 - 文本 / 拍照 */}
      <div className="flex gap-2">
        <button
          onClick={() => switchMode("text")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-pill text-xs font-medium transition-colors",
            inputMode === "text" ? "bg-ink-700 text-white" : "bg-paper-50 text-ink-500 border border-ink-100"
          )}
        >
          <FileText size={14} />
          手写输入
        </button>
        <button
          onClick={() => switchMode("image")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-pill text-xs font-medium transition-colors",
            inputMode === "image" ? "bg-ink-700 text-white" : "bg-paper-50 text-ink-500 border border-ink-100"
          )}
        >
          <ImageIcon size={14} />
          拍照上传
        </button>
      </div>

      {/* 解题步骤区 - 文本模式 */}
      {inputMode === "text" && (
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
      )}

      {/* 拍照/上传区 - 图片模式 */}
      {inputMode === "image" && (
        <section className="rounded-2xl bg-paper-50 border border-ink-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-ink-50 bg-ink-50/50">
            <span className="text-xs font-semibold text-ink-500">上传解题步骤照片</span>
            {imagePreview && (
              <button
                onClick={() => { setImagePreview(""); setImageBase64(""); setDiagnosis(null); }}
                className="text-xs text-ink-400 hover:text-pen-500"
              >
                重新上传
              </button>
            )}
          </div>
          <div className="p-4">
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="解题步骤" className="w-full rounded-lg border border-ink-100 max-h-80 object-contain bg-white" />
                {!loading && !diagnosis && (
                  <div className="mt-2 text-xs text-ink-400 text-center">图片已就绪，点击下方"检查纠错"让AI识别并批注</div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="flex gap-2">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center gap-1.5 px-5 py-3 rounded-xl bg-ink-700 text-white hover:bg-ink-600 transition-colors"
                  >
                    <Camera size={20} />
                    <span className="text-xs">拍照</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-1.5 px-5 py-3 rounded-xl bg-paper-100 text-ink-600 hover:bg-ink-50 border border-ink-100 transition-colors"
                  >
                    <ImageIcon size={20} />
                    <span className="text-xs">相册</span>
                  </button>
                </div>
                <p className="text-xs text-ink-300">拍一张清晰的解题步骤照片，AI会自动识别并标注错误</p>
              </div>
            )}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => handleImageSelect(e.target.files?.[0])}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => handleImageSelect(e.target.files?.[0])}
            />
          </div>
        </section>
      )}

      {/* AI识别后的电子版步骤展示(仅图片模式且有诊断结果时) */}
      {inputMode === "image" && diagnosis?.recognizedSteps && diagnosis.recognizedSteps.length > 0 && !loading && (
        <section className="rounded-2xl bg-paper-50 border border-ink-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-ink-50 bg-ink-50/50">
            <div className="flex items-center gap-1.5">
              <FileText size={14} className="text-ink-500" />
              <span className="text-xs font-semibold text-ink-500">AI识别的电子版步骤</span>
            </div>
            <span className="text-xs text-ink-300">{displaySteps.length} 步</span>
          </div>
          <div className="px-4 py-3 space-y-2">
            {displaySteps.map((step, i) => {
              const isErrorStep = diagnosis.errorStep === i + 1;
              return (
                <div key={i} className="flex items-start gap-2">
                  <span
                    className={cn(
                      "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5",
                      isErrorStep ? "bg-pen-500 text-white animate-pulseSoft" : "bg-ink-100 text-ink-500"
                    )}
                  >
                    {i + 1}
                  </span>
                  <p
                    className={cn(
                      "flex-1 text-sm leading-relaxed py-1",
                      isErrorStep ? "text-pen-700 font-medium" : "text-ink-700"
                    )}
                  >
                    {step}
                    {isErrorStep && <span className="ml-1 text-pen-500 font-serif"> ✗</span>}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

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
          <p className="text-sm text-ink-400">
            {inputMode === "image" ? "AI 正在识别图片并审阅解题步骤..." : "AI 教师正在审阅你的解题步骤..."}
          </p>
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
