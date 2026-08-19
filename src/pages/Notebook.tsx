import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getNotebook, getTags, deleteError } from "@/lib/api";
import SubjectSwitcher from "@/components/SubjectSwitcher";
import { useSubjectStore } from "@/store/subject";
import { SUBJECT_LABELS } from "@/types";
import type { ErrorRecord, TagWithWeight } from "@/types";
import { cn } from "@/lib/utils";
import { Trash2, BookMarked, Filter, ChevronDown, Brain, ChevronRight, BookOpen, AlertCircle, RotateCcw, MessageCircle, Search, X } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  stuck: "卡壳中途",
  calc_error: "计算错误",
  logic_error: "逻辑错误",
  skip_step: "跳步",
  no_idea: "无思路",
  correct: "正确",
};

// 单条错题卡片 - 展示学生步骤(AI标注错误位置) + AI识别推理过程 + 指导
function ErrorCard({ rec, onDelete, onRedo, onAskAI }: {
  rec: ErrorRecord;
  onDelete: (id: number) => void;
  onRedo: (rec: ErrorRecord) => void;
  onAskAI: (rec: ErrorRecord) => void;
}) {
  const [showReasoning, setShowReasoning] = useState(false);
  const hasSteps = rec.studentSteps && rec.studentSteps.length > 0;
  const hasReasoning = !!rec.reasoning;

  return (
    <div className="rounded-xl bg-paper-50 border border-ink-100 overflow-hidden shadow-card">
      <div className="flex">
        <div className="w-1 bg-pen-500" />
        <div className="flex-1 p-4">
          {/* 题目 + 删除 */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-sm font-medium text-ink-700 leading-relaxed flex-1">{rec.question}</p>
            <button
              onClick={() => onDelete(rec.id)}
              className="flex-shrink-0 p-1 text-ink-200 hover:text-pen-500 transition-colors"
            >
              <Trash2 size={15} />
            </button>
          </div>

          {/* 诊断类型 + 出错步骤 + 日期 */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded bg-pen-50 text-pen-600 font-medium">
              {TYPE_LABELS[rec.diagnosisType] || rec.diagnosisType}
            </span>
            {rec.errorStep && (
              <span className="text-xs px-2 py-0.5 rounded bg-pen-500 text-white font-semibold flex items-center gap-1">
                <AlertCircle size={11} />
                第 {rec.errorStep} 步出错
              </span>
            )}
            <span className="text-xs text-ink-300">
              {new Date(rec.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
            </span>
          </div>

          {/* 学生的解题步骤 - 出错步骤用红笔标注 */}
          {hasSteps && (
            <div className="mb-3">
              <div className="text-xs text-ink-400 mb-1.5 flex items-center gap-1">
                <BookOpen size={12} />
                <span>我的解题步骤</span>
              </div>
              <div className="rounded-lg bg-paper-100/50 border border-ink-50 p-2.5 space-y-1">
                {rec.studentSteps.map((step, i) => {
                  const isErrorStep = rec.errorStep === i + 1;
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <span
                        className={cn(
                          "flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold mt-0.5",
                          isErrorStep ? "bg-pen-500 text-white" : "bg-ink-100 text-ink-500"
                        )}
                      >
                        {i + 1}
                      </span>
                      <p
                        className={cn(
                          "text-xs leading-relaxed flex-1",
                          isErrorStep ? "text-pen-700 font-medium" : "text-ink-600"
                        )}
                      >
                        {step}
                        {isErrorStep && (
                          <span className="ml-1 text-pen-500 font-serif"> ✗</span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 核心错误点 - 红笔批注 */}
          {rec.coreError && (
            <div className="rounded-lg bg-pen-50/50 border-l-2 border-pen-500 px-3 py-2 mb-2">
              <p className="text-xs text-pen-700 leading-relaxed">
                <span className="font-semibold">核心错误：</span>{rec.coreError}
              </p>
            </div>
          )}

          {/* AI识别过程 - 可折叠的推理过程,展示AI怎么一步步找出错误 */}
          {hasReasoning && (
            <div className="mb-2">
              <button
                onClick={() => setShowReasoning(!showReasoning)}
                className="w-full flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-700 py-1"
              >
                <Brain size={13} className="text-ink-400" />
                <span className="font-medium">AI识别过程</span>
                <ChevronRight
                  size={13}
                  className={cn("transition-transform ml-auto", showReasoning && "rotate-90")}
                />
              </button>
              {showReasoning && (
                <div className="mt-1.5 rounded-lg bg-ink-50/50 border border-ink-50 px-3 py-2 animate-fadeInUp">
                  <p className="text-xs text-ink-600 leading-relaxed whitespace-pre-wrap">
                    {rec.reasoning}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 教师指导 */}
          {rec.guidance && (
            <div className="rounded-lg bg-paper-100/30 border border-ink-50 px-3 py-2 mb-2">
              <div className="flex items-center gap-1.5 mb-1">
                <BookOpen size={11} className="text-ink-400" />
                <span className="text-xs font-medium text-ink-500">教师指导</span>
              </div>
              <p className="text-xs text-ink-600 leading-relaxed">{rec.guidance}</p>
            </div>
          )}

          {/* 薄弱标签 */}
          {rec.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {rec.tags.map((tag, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded bg-pen-50 text-pen-600 font-medium border border-pen-100">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* 掌握度进度条 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-300">掌握度</span>
            <div className="flex-1 h-1.5 rounded-full bg-ink-50 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  rec.mastery >= 80 ? "bg-sage-500" : rec.mastery >= 50 ? "bg-amber" : "bg-pen-500"
                )}
                style={{ width: `${rec.mastery}%` }}
              />
            </div>
            <span className="text-xs font-bold text-ink-400 w-8 text-right">{rec.mastery}%</span>
          </div>

          {/* 操作按钮:重做 / 问AI */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onRedo(rec)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-pill bg-ink-700 text-white text-xs font-medium hover:bg-ink-600 transition-colors"
            >
              <RotateCcw size={14} />
              错题重做
            </button>
            <button
              onClick={() => onAskAI(rec)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-pill bg-amber/15 text-amber border border-amber/30 text-xs font-medium hover:bg-amber/25 transition-colors"
            >
              <MessageCircle size={14} />
              问AI讲解
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Notebook() {
  const { subject } = useSubjectStore();
  const navigate = useNavigate();
  const [records, setRecords] = useState<ErrorRecord[]>([]);
  const [tags, setTags] = useState<TagWithWeight[]>([]);
  const [activeTag, setActiveTag] = useState<string | undefined>();
  const [showFilter, setShowFilter] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");

  const load = (tag?: string) => {
    Promise.all([getNotebook(subject, tag), getTags(subject)])
      .then(([r, t]) => { setRecords(r); setTags(t); })
      .catch(console.error);
  };

  useEffect(() => {
    // 切换学科时重置标签筛选,避免选中不存在的标签
    setActiveTag(undefined);
    setShowFilter(false);
    setSearchKeyword("");
    load();
  }, [subject]);

  const handleFilter = (tag?: string) => {
    setActiveTag(tag);
    setShowFilter(false);
    load(tag);
  };

  const handleDelete = async (id: number) => {
    await deleteError(id);
    load(activeTag);
  };

  // 错题重做:把题目存入 sessionStorage(刷新不丢),再跳转到解题页
  const handleRedo = (rec: ErrorRecord) => {
    try {
      sessionStorage.setItem('ai-teacher-redo', JSON.stringify({
        question: rec.question,
        subject: rec.subject,
        errorId: rec.id,
      }));
    } catch { /* 忽略存储异常 */ }
    navigate('/solve');
  };

  // 问AI讲解:把题目和错因存入 sessionStorage,跳转到聊天页
  const handleAskAI = (rec: ErrorRecord) => {
    try {
      sessionStorage.setItem('ai-teacher-chat', JSON.stringify({
        question: rec.question,
        subject: rec.subject,
        coreError: rec.coreError,
        guidance: rec.guidance,
        studentSteps: rec.studentSteps,
        preset: `老师，这道题我做错了，请帮我讲解这道题的答案和详细解题过程：\n\n${rec.question}\n\n我的错误是：${rec.coreError || '（无记录）'}`,
      }));
    } catch { /* 忽略存储异常 */ }
    navigate('/chat');
  };

  // 关键词搜索过滤(题目或步骤包含关键词)
  const filteredRecords = searchKeyword.trim()
    ? records.filter(rec => {
        const kw = searchKeyword.trim().toLowerCase();
        return rec.question.toLowerCase().includes(kw)
          || rec.coreError.toLowerCase().includes(kw)
          || rec.guidance.toLowerCase().includes(kw)
          || rec.tags.some(t => t.toLowerCase().includes(kw))
          || (rec.studentSteps || []).some(s => s.toLowerCase().includes(kw));
      })
    : records;

  return (
    <div className="px-5 pt-12 pb-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-ink-700">{SUBJECT_LABELS[subject]}错题本</h1>
          <p className="text-sm text-ink-400 mt-0.5">{filteredRecords.length} 道错题 · 自适应巩固</p>
        </div>
        <button
          onClick={() => setShowFilter(!showFilter)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-pill bg-paper-50 border border-ink-100 text-xs text-ink-500"
        >
          <Filter size={14} />
          {activeTag || "全部"}
          <ChevronDown size={13} className={cn("transition-transform", showFilter && "rotate-180")} />
        </button>
      </header>

      <SubjectSwitcher />

      {/* 搜索框 */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
        <input
          type="text"
          value={searchKeyword}
          onChange={e => setSearchKeyword(e.target.value)}
          placeholder="搜索题目、错因、标签或步骤..."
          className="w-full pl-9 pr-9 py-2.5 rounded-pill bg-paper-50 border border-ink-100 text-sm text-ink-700 placeholder:text-ink-300 focus:outline-none focus:border-ink-300"
        />
        {searchKeyword && (
          <button
            onClick={() => setSearchKeyword("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-ink-300 hover:text-ink-500"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* 标签筛选 */}
      {showFilter && (
        <div className="rounded-xl bg-paper-50 border border-ink-100 p-3 space-y-1.5 animate-fadeInUp">
          <button
            onClick={() => handleFilter(undefined)}
            className={cn(
              "w-full text-left px-3 py-1.5 rounded-lg text-sm",
              !activeTag ? "bg-ink-50 text-ink-700 font-medium" : "text-ink-500 hover:bg-ink-50/50"
            )}
          >
            全部错题
          </button>
          {tags.map(t => (
            <button
              key={t.name}
              onClick={() => handleFilter(t.name)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm",
                activeTag === t.name ? "bg-pen-50 text-pen-700 font-medium" : "text-ink-500 hover:bg-ink-50/50"
              )}
            >
              <span>{t.name}</span>
              <span className="text-xs text-pen-400">权重 {t.weight}</span>
            </button>
          ))}
        </div>
      )}

      {/* 错题列表 */}
      {filteredRecords.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-ink-100 px-6 py-12 text-center">
          <BookMarked size={32} className="text-ink-200 mx-auto mb-3" />
          <p className="text-sm text-ink-400">{searchKeyword ? "没有匹配的错题" : "暂无错题"}</p>
          <p className="text-xs text-ink-300 mt-1">{searchKeyword ? "换个关键词试试" : "去解题练习中挑战一下吧"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map(rec => (
            <ErrorCard
              key={rec.id}
              rec={rec}
              onDelete={handleDelete}
              onRedo={handleRedo}
              onAskAI={handleAskAI}
            />
          ))}
        </div>
      )}
    </div>
  );
}
