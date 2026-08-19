/**
 * 认证路由 - 注册/登录/获取当前用户
 * 当前实现:用户名+密码注册登录
 * 预留扩展:phone 字段已存在,后续可加短信验证码注册/登录
 */
import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import {
  createStudent,
  findStudentByUsername,
  findStudentById,
} from '../db.js';
import { signToken, extractToken, verifyToken } from '../lib/jwt.js';

const router = Router();

// 密码哈希:SHA-256 + 静态盐(足够个人项目使用,生产环境应换 bcrypt)
const PASSWORD_SALT = process.env.PASSWORD_SALT || 'ai-teacher-salt-2026';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + PASSWORD_SALT).digest('hex');
}

function isValidUsername(username: string): boolean {
  // 4-20 位,字母数字下划线,必须以字母开头
  return /^[a-zA-Z][a-zA-Z0-9_]{3,19}$/.test(username);
}

function isValidPassword(password: string): boolean {
  // 6-32 位,必须包含字母和数字
  return password.length >= 6 && password.length <= 32 && /[a-zA-Z]/.test(password) && /\d/.test(password);
}

/**
 * POST /api/auth/register
 * Body: { username, password, name? }
 * 返回: { token, user: { id, username, name } }
 */
router.post('/register', (req: Request, res: Response) => {
  const { username, password, name } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ success: false, error: '用户名和密码必填' });
    return;
  }
  if (!isValidUsername(username)) {
    res.status(400).json({ success: false, error: '用户名需 4-20 位,字母开头,只含字母数字下划线' });
    return;
  }
  if (!isValidPassword(password)) {
    res.status(400).json({ success: false, error: '密码 6-32 位,必须包含字母和数字' });
    return;
  }
  if (findStudentByUsername(username)) {
    res.status(409).json({ success: false, error: '用户名已存在' });
    return;
  }
  const id = createStudent({
    name: name || username,
    username,
    passwordHash: hashPassword(password),
  });
  const token = signToken({ sub: id, username });
  res.json({
    success: true,
    data: {
      token,
      user: { id, username, name: name || username },
    },
  });
});

/**
 * POST /api/auth/login
 * Body: { username, password }
 * 返回: { token, user: { id, username, name } }
 */
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ success: false, error: '用户名和密码必填' });
    return;
  }
  const student = findStudentByUsername(username);
  if (!student || !student.password_hash) {
    res.status(401).json({ success: false, error: '用户名或密码错误' });
    return;
  }
  if (student.password_hash !== hashPassword(password)) {
    res.status(401).json({ success: false, error: '用户名或密码错误' });
    return;
  }
  const token = signToken({ sub: student.id, username: student.username });
  res.json({
    success: true,
    data: {
      token,
      user: { id: student.id, username: student.username, name: student.name },
    },
  });
});

/**
 * GET /api/auth/me - 获取当前登录用户
 * 需要 Authorization: Bearer <token>
 */
router.get('/me', (req: Request, res: Response) => {
  const token = extractToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ success: false, error: '未登录', code: 'NO_TOKEN' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ success: false, error: '登录已失效', code: 'INVALID_TOKEN' });
    return;
  }
  const student = findStudentById(payload.sub);
  if (!student) {
    res.status(404).json({ success: false, error: '用户不存在' });
    return;
  }
  res.json({
    success: true,
    data: {
      user: {
        id: student.id,
        username: student.username,
        phone: student.phone,
        name: student.name,
      },
    },
  });
});

/**
 * 预留接口:POST /api/auth/send-sms
 * 未来实现电话注册时,这里接入短信服务商 API 发送验证码
 * 当前返回 501,提示前端该功能未启用
 */
router.post('/send-sms', (_req: Request, res: Response) => {
  res.status(501).json({ success: false, error: '短信验证码功能尚未启用' });
});

/**
 * 预留接口:POST /api/auth/register-phone
 * 未来实现电话注册:body { phone, code, password?, name? }
 * 验证码通过后创建/绑定学生
 */
router.post('/register-phone', (_req: Request, res: Response) => {
  res.status(501).json({ success: false, error: '电话注册功能尚未启用' });
});

export default router;
