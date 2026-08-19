/**
 * 认证中间件 - 校验 JWT,挂载 req.user
 * 设计:向后兼容
 * - 无 Authorization 头:回退到默认学生(id=1),不报错(兼容旧 App 无登录态)
 * - 带 token 但无效:返回 401
 */
import type { Request, Response, NextFunction } from 'express';
import { verifyToken, extractToken } from './jwt.js';
import { ensureDefaultStudent } from '../db.js';
import { runWithStudent } from './context.js';

// 扩展 Express Request 类型,挂载当前用户信息
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username?: string;
        phone?: string;
      };
    }
  }
}

/**
 * 软认证:有 token 校验 token,无 token 走默认学生(兼容旧客户端)
 * 所有 API 默认使用这个中间件,保证升级期间不破坏现有 App
 * 使用 AsyncLocalStorage 把当前学生 id 注入到后续 service 层
 */
export function authOptional(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req.headers.authorization);
  let studentId: number;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = { id: payload.sub, username: payload.username, phone: payload.phone };
      studentId = payload.sub;
    } else {
      // token 存在但无效,返回 401
      res.status(401).json({ success: false, error: '登录已失效,请重新登录', code: 'INVALID_TOKEN' });
      return;
    }
  } else {
    // 无 token:回退到默认学生(向后兼容)
    studentId = ensureDefaultStudent();
    req.user = { id: studentId };
  }
  // 把 studentId 注入 AsyncLocalStorage,后续 service 层通过 getCurrentStudentId() 读取
  runWithStudent(studentId, () => next());
}

/**
 * 强制认证:必须有有效 token 才能访问
 * 用于注册/登录外的敏感接口(本项目中暂未强制使用,保留给未来扩展)
 */
export function authRequired(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ success: false, error: '请先登录', code: 'NO_TOKEN' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ success: false, error: '登录已失效,请重新登录', code: 'INVALID_TOKEN' });
    return;
  }
  req.user = { id: payload.sub, username: payload.username, phone: payload.phone };
  runWithStudent(payload.sub, () => next());
}
