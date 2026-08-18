import { useEffect, useState } from "react";
import { getNotebook, getTags, deleteError } from "@/lib/api";
import SubjectSwitcher from "@/components/SubjectSwitcher";
import { useSubjectStore } from "@/store/subject";
import { SUBJECT_LABELS } from "@/types";
import type { ErrorRecord, TagWithWeight } from "@/types";
import { cn } from "@/lib/utils";
import { Trash2, BookMarked, Filter, ChevronDown } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  stuck: "卡壳中途",
  calc_error: "计算错误",
  logic_error: "逻辑错误",
  skip_step: "跳步",
  no_idea: "无思路",
  correct: "正确",
};

export default function Notebook() {
  const { subject } = useSubjectStore();
  const [records, setRecords] = useState<ErrorRecord[]>([]);
  const [tags, setTags] = useState<TagWithWeight[]>([]);
  const [activeTag, setActiveTag] = useState<string | undefined>();
  const [showFilter, setShowFilter] = useState(false);

  const load = (tag?: string) => {
    Promise.all([getNotebook(subject, tag), getTags(subject)])
      .then(([r, t]) => { setRecords(r); setTags(t); })
      .catch(console.error);
  };

  useEffect(() => {
    // 切换学科时重置标签筛选,避免选中不存在的标签
    setActiveTag(undefined);
    setShowFilter(false);
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

  return (
    <div className="px-5 pt-12 pb-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-ink-700">{SUBJECT_LABELS[subject]}错题本</h1>
          <p className="text-sm text-ink-400 mt-0.5">{records.length} 道错题 · 自适应巩固</p>
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
      {records.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-ink-100 px-6 py-12 text-center">
          <BookMarked size={32} className="text-ink-200 mx-auto mb-3" />
          <p className="text-sm text-ink-400">暂无错题</p>
          <p className="text-xs text-ink-300 mt-1">去解题练习中挑战一下吧</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(rec => (
            <div key={rec.id} className="rounded-xl bg-paper-50 border border-ink-100 overflow-hidden shadow-card">
              {/* 左侧色条 */}
              <div className="flex">
                <div className="w-1 bg-pen-500" />
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-medium text-ink-700 leading-relaxed">{rec.question}</p>
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="flex-shrink-0 p-1 text-ink-200 hover:text-pen-500 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-pen-50 text-pen-600 font-medium">
                      {TYPE_LABELS[rec.diagnosisType] || rec.diagnosisType}
                    </span>
                    <span className="text-xs text-ink-300">
                      {new Date(rec.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div className="rounded-lg bg-pen-50/50 px-3 py-2 mb-2">
                    <p className="text-xs text-pen-600 leading-relaxed">
                      <span className="font-semibold">核心错误：</span>{rec.coreError}
                    </p>
                  </div>

                  {rec.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {rec.tags.map((tag, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded bg-ink-50 text-ink-500">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 掌握度进度条 */}
                  <div className="mt-3 flex items-center gap-2">
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
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
