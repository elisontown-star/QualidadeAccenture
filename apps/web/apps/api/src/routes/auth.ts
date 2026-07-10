import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { Env } from '../index'

const app = new Hono<{ Bindings: Env }>()

// POST /auth/login
app.post('/login', async (c) => {
  const { email, password } = await c.req.json()

  if (!email || !password) {
    return c.json({ error: 'E-mail e senha são obrigatórios' }, 400)
  }

  const user = await c.env.DB
    .prepare('SELECT * FROM users WHERE email = ? AND is_active = 1')
    .bind(email.toLowerCase().trim())
    .first<{ id: string; name: string; email: string; password_hash: string; role: string }>()

  if (!user) {
    return c.json({ error: 'Credenciais inválidas' }, 401)
  }

  // Verificar senha com bcrypt (implementar via worker-compatible bcrypt)
  const { verifyPassword } = await import('../utils/crypto')
  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    return c.json({ error: 'Credenciais inválidas' }, 401)
  }

  const now = Math.floor(Date.now() / 1000)
  const token = await sign(
    { sub: user.id, email: user.email, role: user.role, iat: now, exp: now + 28800 }, // 8h
    c.env.JWT_SECRET
  )

  return c.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  })
})

// POST /auth/forgot-password
app.post('/forgot-password', async (c) => {
  const { email } = await c.req.json()
  // Envia e-mail de reset via Resend — implementação completa na Fase 1
  // Por segurança, sempre retorna sucesso independente do e-mail existir
  return c.json({ message: 'Se o e-mail existir, você receberá as instruções em breve.' })
})

// POST /auth/reset-password
app.post('/reset-password', async (c) => {
  const { token, password } = await c.req.json()
  // Validar token de reset e atualizar senha — implementação completa na Fase 1
  return c.json({ message: 'Senha redefinida com sucesso.' })
})

export const authRoutes = app
