/**
 * 全局登录状态 - token + 当前用户信息
 * token 持久化到 localStorage,App 启动时自动恢复
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CurrentUser {
  id: number;
  username?: string;
  phone?: string;
  name: string;
}

interface AuthState {
  token: string | null;
  user: CurrentUser | null;
  setAuth: (token: string, user: CurrentUser) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
      isAuthenticated: () => !!get().token,
    }),
    { name: 'ai-teacher-auth' }
  )
);
