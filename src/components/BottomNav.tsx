import { NavLink } from "react-router-dom";
import { Home, PenLine, BookMarked, CalendarCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", icon: Home, label: "首页" },
  { to: "/solve", icon: PenLine, label: "解题" },
  { to: "/notebook", icon: BookMarked, label: "错题本" },
  { to: "/daily", icon: CalendarCheck, label: "每日十题" },
  { to: "/profile", icon: UserRound, label: "画像" },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-paper-50/95 backdrop-blur-md border-t border-ink-100 z-50">
      <div className="flex items-stretch justify-around px-2 py-1.5">
        {TABS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[56px]",
                isActive
                  ? "text-ink-700"
                  : "text-ink-300 hover:text-ink-500"
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    "p-1.5 rounded-lg transition-all duration-200",
                    isActive ? "bg-ink-50" : ""
                  )}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                </div>
                <span className={cn("text-[11px]", isActive ? "font-semibold" : "font-medium")}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
