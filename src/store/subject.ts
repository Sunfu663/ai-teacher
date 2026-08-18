/**
 * 全局学科状态 - 跨页面共享当前选中的学科
 * 切换学科后所有页面数据自动按新学科重新加载
 */
import { create } from 'zustand';
import type { Subject } from '../types';
import { persist } from 'zustand/middleware';

interface SubjectState {
  subject: Subject;
  setSubject: (s: Subject) => void;
}

export const useSubjectStore = create<SubjectState>()(
  persist(
    (set) => ({
      subject: 'math',
      setSubject: (subject) => set({ subject }),
    }),
    { name: 'ai-teacher-subject' }
  )
);
