/**
 * API 服务器入口
 */
import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import analyzeRoutes from './routes/analyze.js'
import notebookRoutes from './routes/notebook.js'
import tagRoutes from './routes/tags.js'
import dailyRoutes from './routes/daily.js'
import profileRoutes from './routes/profile.js'
import questionRoutes from './routes/questions.js'
import authRoutes from './routes/auth.js'
import { authOptional } from './lib/auth.js'

import { ensureDefaultStudent } from './db.js'
import { seedDatabase } from './seed.js'

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '15mb' }))
app.use(express.urlencoded({ extended: true, limit: '15mb' }))

// 初始化数据库:确保默认学生存在 + 播种题库
try {
  ensureDefaultStudent()
  seedDatabase()
} catch (err) {
  console.error('数据库初始化失败:', err)
}

/**
 * 认证路由(注册/登录/获取当前用户) - 不走 authOptional 中间件
 */
app.use('/api/auth', authRoutes)

/**
 * 软认证中间件:有 token 校验,无 token 回退到默认学生(向后兼容旧 App)
 * 挂载在所有数据路由之前,把 req.user 注入到后续处理
 */
app.use('/api', authOptional)

/**
 * API 路由(经过软认证后,req.user.id 即为当前学生 id)
 */
app.use('/api/analyze', analyzeRoutes)
app.use('/api/notebook', notebookRoutes)
app.use('/api/tags', tagRoutes)
app.use('/api/daily', dailyRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/questions', questionRoutes)

/**
 * 健康检查
 */
app.use('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: 'ok' })
})

/**
 * 错误处理
 */
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('服务器错误:', error)
  res.status(500).json({ success: false, error: '服务器内部错误' })
})

/**
 * 404
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: '接口不存在' })
})

export default app
