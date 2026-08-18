/**
 * 学科切换器 - 顶部三科分段控件
 * 切换后全局 subject 状态变更,各页面自动响应
 */
import { useSubjectStore } from '@/store/subject';
import { SUBJECT_LABELS } from "@/types";
import type { Subject } from "@/types";
import { cn } from "@/lib/utils";

const SUBJECTS: Subject[] = ['math', 'physics', 'chemistry'];

export default function SubjectSwitcher({ className }: { className?: string }) {
  const { subject, setSubject } = useSubjectStore();

  return (
    <div className={cn("inline-flex p-0.5 rounded-pill bg-paper-200 border border-ink-100", className)}>
      {SUBJECTS.map((s) => (
        <button
          key={s}
          onClick={() => setSubject(s)}
          className={cn(
            "px-4 py-1.5 rounded-pill text-sm font-semibold transition-all duration-200",
            subject === s
              ? "bg-ink-700 text-white shadow-sm"
              : "text-ink-400 hover:text-ink-600"
          )}
        >
          {SUBJECT_LABELS[s]}
        </button>
      ))}
    </div>
  );
}
