import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";

/**
 * 应用主框架 - 移动端居中容器 + 底部导航
 */
export default function Layout() {
  return (
    <div className="min-h-screen flex justify-center bg-paper-200">
      <div className="relative w-full max-w-[480px] min-h-screen bg-paper-100 shadow-card flex flex-col">
        <main className="flex-1 overflow-y-auto pb-20">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
