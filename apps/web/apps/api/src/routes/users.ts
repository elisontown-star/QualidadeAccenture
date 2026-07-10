import { Hono } from 'hono'
import { Env } from '../index'
import { requireAdmin } from '../middleware/auth'
import { generateId } from '../utils/id'

const app = new Hono<{ Bindings: Env }>()

// GET /users — listar usuários (admin only)
app.get('/', requireAdmin, async (c) => {
  const { role, is_active, page = '1', limit = '20' } = c.req.query()
  const offset = (parseInt(page) - 1) * parseInt(limit)

  let query = 'SELECT id, name, email, role, is_active, created_at FROM users WHERE 1=1'
  const params: any[] = []

  if (role) { query += ' AND role = ?'; params.push(role) }
  if (is_active !== undefined) { query += ' AND is_active = ?'; params.push(parseInt(is_active)) }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
  params.push(parseInt(limit), offset)

  const users = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ data: users.results, total: users.results.length })
})

// POST /users — criar usuário (admin only)
app.post('/', requireAdmin, async (c) => {
  const { name, email, password, role } = await c.req.json()

  if (!name || !email || !password || !role) {
    return c.json({ error: 'Campos obrigatórios: name, email, password, role' }, 400)
  }
  if (!['admin', 'monitor', 'coordinator'].includes(role)) {
    return c.json({ error: 'Role inválido' }, 400)
  }

  const existing = await c.env.DB
    .prepare('SELECT id FROM users WHERE email = ?')
    .bind(email.toLowerCase())
    .first()
  if (existing) return c.json({ error: 'E-mail já cadastrado' }, 409)

  const { hashPassword } = await import('../utils/crypto')
  const password_hash = await hashPassword(password)
  const id = generateId('usr')

  await c.env.DB.prepare(
    'INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, name, email.toLowerCase(), password_hash, role).run()

  // TODO: Enviar e-mail de boas-vindas via Resend

  return c.json({ id, name, email, role }, 201)
})

// PUT /users/:id — atualizar usuário (admin only)
app.put('/:id', requireAdmin, async (c) => {
  const { id } = c.req.param()
  const { name, role } = await c.req.json()

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first()
  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404)

  await c.env.DB.prepare(
    'UPDATE users SET name = COALESCE(?, name), role = COALESCE(?, role), updated_at = datetime(\'now\') WHERE id = ?'
  ).bind(name ?? null, role ?? null, id).run()

  return c.json({ message: 'Usuário atualizado com sucesso' })
})

// PATCH /users/:id/toggle — ativar/desativar usuário (admin only)
app.patch('/:id/toggle', requireAdmin, async (c) => {
  const { id } = c.req.param()
  const user = await c.env.DB
    .prepare('SELECT id, is_active FROM users WHERE id = ?')
    .bind(id)
    .first<{ id: string; is_active: number }>()

  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404)

  const newStatus = user.is_active === 1 ? 0 : 1
  await c.env.DB
    .prepare('UPDATE users SET is_active = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .bind(newStatus, id)
    .run()

  return c.json({ is_active: newStatus, message: newStatus ? 'Usuário ativado' : 'Usuário desativado' })
})

export const userRoutes = app
