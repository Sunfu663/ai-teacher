/**
 * 极简 JWT 实现(HS256) - 不引入 jsonwebtoken 依赖
 * 使用 Node 内置 crypto 模块,避免 Serverless 环境额外安装
 */
import crypto from 'crypto';

// 密钥:优先读环境变量,否则使用默认值(本地开发)
const SECRET = process.env.JWT_SECRET || 'ai-teacher-default-jwt-secret-2026';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 天

function base64UrlEncode(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8');
}

export interface JwtPayload {
  sub: number;       // student id
  username?: string; // 用户名(电话注册时为空)
  phone?: string;    // 手机号(电话注册预留)
  iat?: number;      // 签发时间
  exp?: number;      // 过期时间
}

export function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${header}.${body}`;
  const signature = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function verifyToken(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const data = `${header}.${body}`;
  const expectedSig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  // 用时间安全比较防止时序攻击
  if (expectedSig.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signature))) {
    return null;
  }
  try {
    const payload = JSON.parse(base64UrlDecode(body)) as JwtPayload;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // 已过期
    }
    return payload;
  } catch {
    return null;
  }
}

// 从 Authorization 头提取 token
export function extractToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
