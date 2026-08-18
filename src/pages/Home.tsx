import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PenLine, CalendarCheck, BookMarked, Flame, TrendingDown, ChevronRight, Clock } from "lucide-react";
import { getTopWeakTags, getRecentErrors, getProfile } from "@/lib/api";
import { useSubjectStore } from "@/store/subject";
import { SUBJECT_LABELS } from "@/types";
import type { TagWithWeight, ErrorRecord, ProfileData } from "@/types";
import SubjectSwitcher from "@/components/SubjectSwitcher";

export default function Home() {
  const navigate = useNavigate();
  const { subject } = useSubjectStore();
  const [weakTags, setWeakTags] = useState<TagWithWeight[]>([]);
  const [recentErrors, setRecentErrors] = useState<ErrorRecord[]>([]);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    Promise.all([getTopWeakTags(subject, 3), getRecentErrors(subject, 3), getProfile(subject)])
      .then(([tags, errors, p]) => {
        setWeakTags(tags);
        setRecentErrors(errors);
        setProfile(p);
      })
      .catch(console.error);
  }, [subject]);

  return (
    <div className="px-5 pt-12 pb-6 space-y-6">
      {/* 顶部问候 + 学科切换 */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-400">你好，同学</p>
          <h1 className="text-2xl font-serif font-bold text-ink-700">今日学习</h1>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-pen-50">
          <Flame size={16} className="text-pen-500" />
          <span className="text-sm font-bold text-pen-600">{profile?.streakDays || 0}</span>
          <span className="text-xs text-pen-400">天</span>
        </div>
      </header>

      {/* 学科切换 */}
      <SubjectSwitcher />

      {/* 今日概览卡 */}
      <section className="rounded-2xl bg-gradient-to-br from-ink-700 to-ink-600 p-5 shadow-cardHover text-white">
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-ink-100 text-xs mb-1">{SUBJECT_LABELS[subject]} · 累计解题</p>
            <p className="text-3xl font-serif font-bold">{profile?.totalSolved || 0}</p>
          </div>
          <div className="text-right">
            <p className="text-ink-100 text-xs mb-1">{SUBJECT_LABELS[subject]} · 错题</p>
            <p className="text-3xl font-serif font-bold text-pen-200">{profile?.totalErrors || 0}</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/daily")}
          className="w-full rounded-xl bg-white/15 hover:bg-white/25 transition-colors py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
        >
          <CalendarCheck size={16} />
          {SUBJECT_LABELS[subject]}每日十题
        </button>
      </section>

      {/* 快捷入口 */}
      <section>
        <div className="grid grid-cols-3 gap-3">
          <QuickEntry icon={PenLine} label="解题练习" color="ink" onClick={() => navigate("/solve")} />
          <QuickEntry icon={CalendarCheck} label="每日十题" color="sage" onClick={() => navigate("/daily")} />
          <QuickEntry icon={BookMarked} label="错题本" color="pen" onClick={() => navigate("/notebook")} />
        </div>
      </section>

      {/* 薄弱标签提醒 */}
      {weakTags.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <TrendingDown size={16} className="text-pen-500" />
              <h2 className="text-base font-serif font-bold text-ink-700">{SUBJECT_LABELS[subject]}薄弱点</h2>
            </div>
            <button onClick={() => navigate("/profile")} className="text-xs text-ink-400 flex items-center">
              全部 <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {weakTags.map((tag) => (
              <div key={tag.name} className="flex items-center justify-between rounded-xl bg-paper-50 border border-ink-100 px-4 py-2.5">
                <span className="text-sm font-medium text-ink-700">{tag.name}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full bg-ink-50 overflow-hidden">
                    <div className="h-full rounded-full bg-pen-500 transition-all" style={{ width: `${tag.weight}%` }} />
                  </div>
                  <span className="text-xs font-bold text-pen-500 w-8 text-right">{tag.weight}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 最近错题 */}
      {recentErrors.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <Clock size={16} className="text-ink-400" />
              <h2 className="text-base font-serif font-bold text-ink-700">最近错题</h2>
            </div>
            <button onClick={() => navigate("/notebook")} className="text-xs text-ink-400 flex items-center">
              全部 <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {recentErrors.map((err) => (
              <button
                key={err.id}
                onClick={() => navigate("/notebook")}
                className="w-full text-left rounded-xl bg-paper-50 border border-ink-100 px-4 py-3 hover:shadow-card transition-shadow"
              >
                <p className="text-sm text-ink-700 line-clamp-1 mb-1">{err.question}</p>
                <span className="text-xs text-pen-500 font-medium">{err.coreError.slice(0, 30)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 空状态引导 */}
      {recentErrors.length === 0 && weakTags.length === 0 && (
        <section className="rounded-2xl border-2 border-dashed border-ink-100 px-6 py-10 text-center">
          <PenLine size={32} className="text-ink-200 mx-auto mb-3" />
          <p className="text-sm text-ink-400 mb-1">{SUBJECT_LABELS[subject]}还没有学习记录</p>
          <p className="text-xs text-ink-300 mb-4">开始你的第一次{SUBJECT_LABELS[subject]}解题练习吧</p>
          <button
            onClick={() => navigate("/solve")}
            className="rounded-pill bg-ink-700 text-white px-6 py-2.5 text-sm font-semibold hover:bg-ink-600 transition-colors"
          >
            开始解题
          </button>
        </section>
      )}
    </div>
  );
}

function QuickEntry({ icon: Icon, label, color, onClick }: {
  icon: typeof PenLine;
  label: string;
  color: "ink" | "sage" | "pen";
  onClick: () => void;
}) {
  const colorMap = {
    ink: "bg-ink-50 text-ink-600",
    sage: "bg-sage-50 text-sage-600",
    pen: "bg-pen-50 text-pen-600",
  };
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-2xl bg-paper-50 border border-ink-100 py-4 hover:shadow-cardHover hover:-translate-y-0.5 transition-all"
    >
      <div className={`p-2.5 rounded-xl ${colorMap[color]}`}>
        <Icon size={22} />
      </div>
      <span className="text-xs font-medium text-ink-700">{label}</span>
    </button>
  );
}
