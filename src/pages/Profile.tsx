import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProfile } from "@/lib/api";
import SubjectSwitcher from "@/components/SubjectSwitcher";
import { useSubjectStore } from "@/store/subject";
import { useAuthStore } from "@/store/auth";
import { SUBJECT_LABELS } from "@/types";
import type { ProfileData } from "@/types";
import RadarChart from "@/components/RadarChart";
import { PenLine, AlertCircle, Flame, Target, Radar as RadarIcon, LogIn, LogOut, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Profile() {
  const { subject } = useSubjectStore();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    getProfile(subject).then(setProfile).catch(console.error);
  }, [subject]);

  if (!profile) {
    return (
      <div className="px-5 pt-12">
        <div className="mb-4"><SubjectSwitcher /></div>
        <p className="text-sm text-ink-400">加载中...</p>
      </div>
    );
  }

  const radarData = profile.weakTags.slice(0, 6).map(t => ({ name: t.name, value: t.weight }));

  function handleLogout() {
    clearAuth();
    // 退出后留在当前页,以游客身份继续
    window.location.reload();
  }

  return (
    <div className="px-5 pt-12 pb-6 space-y-6">
      <header>
        <h1 className="text-2xl font-serif font-bold text-ink-700">{SUBJECT_LABELS[subject]}学习画像</h1>
        <p className="text-sm text-ink-400 mt-0.5">你的{SUBJECT_LABELS[subject]}知识掌握全景</p>
      </header>

      {/* 账号卡片 */}
      <section className="rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center">
          <UserCircle size={28} />
        </div>
        <div className="flex-1 min-w-0">
          {user ? (
            <>
              <p className="text-sm font-bold text-ink-700 truncate">{user.name}</p>
              <p className="text-xs text-ink-400 truncate">
                {user.username ? `账号: ${user.username}` : '已登录'}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-ink-700">游客模式</p>
              <p className="text-xs text-ink-400">数据保存在本机,登录后可云端同步</p>
            </>
          )}
        </div>
        {user ? (
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-3 py-1.5 rounded-pill text-xs font-medium text-pen-600 bg-pen-50 hover:bg-pen-100 transition"
          >
            <LogOut size={14} /> 退出
          </button>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-pill text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition"
          >
            <LogIn size={14} /> 登录
          </button>
        )}
      </section>

      <SubjectSwitcher />

      {/* 数据统计 */}
      <section className="grid grid-cols-3 gap-3">
        <StatCard icon={PenLine} label="累计解题" value={profile.totalSolved} color="ink" />
        <StatCard icon={AlertCircle} label="错题总数" value={profile.totalErrors} color="pen" />
        <StatCard icon={Flame} label="连续天数" value={profile.streakDays} color="amber" />
      </section>

      {/* 薄弱标签雷达图 */}
      {radarData.length >= 3 ? (
        <section className="rounded-2xl bg-paper-50 border border-ink-100 p-5">
          <div className="flex items-center gap-1.5 mb-2">
            <RadarIcon size={16} className="text-pen-500" />
            <h2 className="text-base font-serif font-bold text-ink-700">{SUBJECT_LABELS[subject]}薄弱方向雷达</h2>
          </div>
          <p className="text-xs text-ink-400 mb-3">权重越高（越靠外），说明该方向越薄弱</p>
          <RadarChart data={radarData} />
        </section>
      ) : (
        <section className="rounded-2xl border-2 border-dashed border-ink-100 px-6 py-8 text-center">
          <RadarIcon size={28} className="text-ink-200 mx-auto mb-2" />
          <p className="text-sm text-ink-400">暂无足够薄弱标签生成雷达图</p>
          <p className="text-xs text-ink-300 mt-1">多做几道题，画像会更清晰</p>
        </section>
      )}

      {/* 知识点掌握度地图 */}
      <section>
        <div className="flex items-center gap-1.5 mb-3">
          <Target size={16} className="text-ink-500" />
          <h2 className="text-base font-serif font-bold text-ink-700">知识点掌握度</h2>
        </div>
        <div className="space-y-2.5">
          {profile.masteryMap.map((m, i) => (
            <div key={i} className="rounded-xl bg-paper-50 border border-ink-100 px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-ink-700">{m.chapter}</span>
                <span className={cn(
                  "text-xs font-bold",
                  m.mastery >= 80 ? "text-sage-600" : m.mastery >= 50 ? "text-amber" : "text-pen-500"
                )}>
                  {m.mastery >= 80 ? "精通" : m.mastery >= 50 ? "熟悉" : m.mastery > 0 ? "薄弱" : "未学"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-ink-50 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      m.mastery >= 80 ? "bg-sage-500" : m.mastery >= 50 ? "bg-amber" : "bg-pen-500"
                    )}
                    style={{ width: `${m.mastery}%` }}
                  />
                </div>
                <span className="text-xs text-ink-400 w-8 text-right">{m.mastery}%</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 薄弱标签列表 */}
      {profile.weakTags.length > 0 && (
        <section>
          <h2 className="text-base font-serif font-bold text-ink-700 mb-3">全部薄弱标签</h2>
          <div className="flex flex-wrap gap-2">
            {profile.weakTags.map(t => (
              <div
                key={t.name}
                className="flex items-center gap-2 px-3 py-1.5 rounded-pill border"
                style={{
                  backgroundColor: `rgba(230, 57, 70, ${0.04 + (t.weight / 100) * 0.1})`,
                  borderColor: `rgba(230, 57, 70, ${0.15 + (t.weight / 100) * 0.2})`,
                }}
              >
                <span className="text-sm font-medium text-pen-700">{t.name}</span>
                <span className="text-xs font-bold text-pen-500">{t.weight}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof PenLine;
  label: string;
  value: number;
  color: "ink" | "pen" | "amber";
}) {
  const colorMap = {
    ink: { bg: "bg-ink-50", text: "text-ink-600" },
    pen: { bg: "bg-pen-50", text: "text-pen-600" },
    amber: { bg: "bg-amber/10", text: "text-amber" },
  };
  return (
    <div className="rounded-2xl bg-paper-50 border border-ink-100 p-4 text-center">
      <div className={cn("inline-flex p-2 rounded-xl mb-2", colorMap[color].bg)}>
        <Icon size={18} className={colorMap[color].text} />
      </div>
      <p className="text-2xl font-serif font-bold text-ink-700">{value}</p>
      <p className="text-xs text-ink-400 mt-0.5">{label}</p>
    </div>
  );
}
