/**
 * Vercel Serverless 入口
 * 把 Express 应用包装成 Vercel 函数
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server/app.js';

// Vercel 函数需要默认导出一个 handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Express 4 不能直接处理 Vercel 的 req/res,需要手动套一层
  return app(req as any, res as any);
}
