import { Context, Next } from 'hono'
import { verify } from 'hono/jwt'
import { Env } from '../index'

export type JWTPayload = {
  sub: string      // userId
  email: string
  role: 'admin' | 'monitor' | 'coordinator'
  iat: number
  exp: number
}

declare module 'hono' {
  interface ContextVariableMap {
    user: JWTPayload
  }
}

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Token de acesso não fornecido' }, 401)
  }

  const token = authHeader.slice(7)
  try {
    const payload = await verify(token, c.env.JWT_SECRET) as JWTPayload
    c.set('user', payload)
    await next()
  } catch {
    return c.json({ error: 'Token inválido ou expirado' }, 401)
  }
}

// ── RBAC helpers ─────────────────────────────────────────────────────────────
export function requireRole(...roles: JWTPayload['role'][]) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get('user')
    if (!roles.includes(user.role)) {
      return c.json({ error: 'Acesso negado — permissão insuficiente' }, 403)
    }
    await next()
  }
}

export const requireAdmin = requireRole('admin')
export const requireAdminOrMonitor = requireRole('admin', 'monitor')
