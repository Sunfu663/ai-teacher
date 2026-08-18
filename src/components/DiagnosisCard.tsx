import { AlertCircle, Calculator, GitBranch, Footprints, Lightbulb, CheckCircle2, BookOpen, Tag } from "lucide-react";
import type { AnalyzeResponse, DiagnosisType } from "@/types";
import { cn } from "@/lib/utils";

const DIAGNOSIS_CONFIG: Record<DiagnosisType, { label: string; color: string; bg: string; icon: typeof AlertCircle }> = {
  stuck: { label: "卡壳中途", color: "text-amber", bg: "bg-amber/10", icon: Lightbulb },
  calc_error: { label: "计算错误", color: "text-pen-600", bg: "bg-pen-50", icon: Calculator },
  logic_error: { label: "逻辑错误", color: "text-pen-600", bg: "bg-pen-50", icon: GitBranch },
  skip_step: { label: "跳步", color: "text-pen-600", bg: "bg-pen-50", icon: Footprints },
  no_idea: { label: "完全无思路", color: "text-amber", bg: "bg-amber/10", icon: Lightbulb },
  correct: { label: "完全正确", color: "text-sage-600", bg: "bg-sage-50", icon: CheckCircle2 },
};

interface Props {
  diagnosis: AnalyzeResponse;
  aiEnabled?: boolean;
}

export default function DiagnosisCard({ diagnosis, aiEnabled }: Props) {
  const config = DIAGNOSIS_CONFIG[diagnosis.diagnosisType] || DIAGNOSIS_CONFIG.logic_error;
  const Icon = config.icon;
  const isError = !diagnosis.isCorrect;

  return (
    <div className="animate-fadeInUp space-y-4">
      {/* 模拟模式提示 */}
      {aiEnabled === false && (
        <div className="rounded-xl bg-amber/10 border border-amber/30 px-4 py-2.5 text-xs text-amber flex items-center gap-2">
          <AlertCircle size={14} />
          <span>当前为模拟诊断模式。在 .env 配置 AI_API_KEY 后启用真实 AI 教师</span>
        </div>
      )}

      {/* 诊断类型标签 */}
      <div className="flex items-center gap-2">
        <div className={cn("flex items-center gap-1.5 px-3 py-1 rounded-pill text-sm font-semibold", config.bg, config.color)}>
          <Icon size={16} />
          {config.label}
        </div>
        {diagnosis.errorStep && (
          <span className="text-sm text-pen-600 font-medium">
            第 {diagnosis.errorStep} 步出错
          </span>
        )}
      </div>

      {/* 核心错误点 - 红笔批注 */}
      {isError && diagnosis.coreError && (
        <div className="relative rounded-xl bg-pen-50 border-l-4 border-pen-500 px-4 py-3">
          <div className="flex items-start gap-2">
            <span className="text-pen-500 font-serif text-lg leading-none mt-0.5">✗</span>
            <div>
              <div className="text-xs font-semibold text-pen-700 mb-1">核心错误点</div>
              <p className="text-sm text-ink-700 leading-relaxed">{diagnosis.coreError}</p>
            </div>
          </div>
        </div>
      )}

      {/* 指导思路 - 教师批注 */}
      <div className="rounded-xl bg-paper-50 border border-ink-100 px-4 py-3.5 shadow-card">
        <div className="flex items-center gap-1.5 mb-2">
          <BookOpen size={15} className="text-ink-500" />
          <span className="text-xs font-semibold text-ink-500">教师指导</span>
        </div>
        <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">{diagnosis.guidance}</p>
      </div>

      {/* 课本知识点 */}
      {diagnosis.knowledgePoints.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <BookOpen size={14} className="text-ink-400" />
            <span className="text-xs font-medium text-ink-400">课本知识点</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {diagnosis.knowledgePoints.map((kp, i) => (
              <span key={i} className="px-2.5 py-1 rounded-lg bg-ink-50 text-ink-600 text-xs font-medium">
                {kp}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 薄弱标签 */}
      {diagnosis.weakTags.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Tag size={14} className="text-pen-400" />
            <span className="text-xs font-medium text-pen-400">薄弱标签 · 已自动收录</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {diagnosis.weakTags.map((tag, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-lg bg-pen-50 text-pen-600 text-xs font-semibold border border-pen-100"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 正确鼓励 */}
      {!isError && (
        <div className="rounded-xl bg-sage-50 border border-sage-100 px-4 py-3 flex items-center gap-2">
          <CheckCircle2 size={18} className="text-sage-500" />
          <span className="text-sm text-sage-700 font-medium">做得很好！思路清晰，继续加油</span>
        </div>
      )}
    </div>
  );
}
