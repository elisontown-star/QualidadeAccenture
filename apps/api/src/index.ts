import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'

import { authRoutes } from './routes/auth'
import { userRoutes } from './routes/users'
import { importRoutes } from './routes/imports'
import { taskRoutes } from './routes/tasks'
import { evaluationRoutes } from './routes/evaluations'
import { reportRoutes } from './routes/reports'
import { dashboardRoutes } from './routes/dashboard'
import { authMiddleware } from './middleware/auth'

export type Env = {
  DB: D1Database
  JWT_SECRET: string
  RESEND_API_KEY: string
  ENVIRONMENT: string
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', logger())
app.use('*', prettyJSON())
app.use('*', cors({
  origin: (origin) => {
    const allowed = [
      'http://localhost:5173',
      'https://quality.accenture.com',
    ]
    if (!origin) return '*'
    if (allowed.includes(origin)) return origin
    if (origin.endsWith('.pages.dev')) return origin
    if (origin.endsWith('.workers.dev')) return origin
    return allowed[0]
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

app.get('/', (c) => c.json({ status: 'ok', app: 'Quality Platform API', version: '1.0.0' }))
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.route('/auth', authRoutes)

app.use('/users/*', authMiddleware)
app.use('/imports/*', authMiddleware)
app.use('/tasks/*', authMiddleware)
app.use('/evaluations/*', authMiddleware)
app.use('/reports/*', authMiddleware)
app.use('/dashboard/*', authMiddleware)

app.route('/users', userRoutes)
app.route('/imports', importRoutes)
app.route('/tasks', taskRoutes)
app.route('/evaluations', evaluationRoutes)
app.route('/reports', reportRoutes)
app.route('/dashboard', dashboardRoutes)

app.notFound((c) => c.json({ error: 'Rota não encontrada' }, 404))

app.onError((err, c) => {
  console.error('[ERROR]', err)
  return c.json({ error: 'Erro interno do servidor' }, 500)
})

export default app
