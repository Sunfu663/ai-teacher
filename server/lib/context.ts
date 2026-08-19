/**
 * 请求上下文 - 使用 AsyncLocalStorage 在整条请求链路中传递当前学生 id
 * 避免给每个 service 函数加 studentId 参数(改动太大)
 * Express 单进程内并发安全
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { ensureDefaultStudent } from '../db.js';

interface RequestContext {
  studentId: number;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * 在中间件中运行请求处理函数,绑定当前学生 id 到上下文
 * 未登录时回退到默认学生 id=1
 */
export function runWithStudent<T>(studentId: number, fn: () => T): T {
  return storage.run({ studentId }, fn);
}

/**
 * 在 service 层读取当前学生 id
 * 上下文不存在(比如启动时 seedDatabase 调用)时回退到默认学生
 */
export function getCurrentStudentId(): number {
  const ctx = storage.getStore();
  if (ctx) return ctx.studentId;
  // 上下文外调用(如启动初始化、脚本)回退到默认学生
  return ensureDefaultStudent();
}
