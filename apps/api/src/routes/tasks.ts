import { Hono } from 'hono'
import { Env } from '../index'
import { requireAdmin, requireAdminOrMonitor } from '../middleware/auth'

const app = new Hono<{ Bindings: Env }>()

// ─── GET /tasks — listar tarefas com filtros ──────────────────────────────────
app.get('/', async (c) => {
  const user = c.get('user')
  const {
    status, indicator, call_type, assigned_to, monitor_id,
    page = '1', limit = '20',
  } = c.req.query()
  const offset = (parseInt(page) - 1) * parseInt(limit)

  let query = `
    SELECT t.*, o.name as operator_name, o.external_id as operator_code,
           u.name as assigned_name
    FROM tasks t
    LEFT JOIN operators o ON t.operator_id = o.id
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE 1=1
  `
  const params: any[] = []

  // Monitors veem apenas as próprias tarefas
  if (user.role === 'monitor') {
    query += ' AND t.assigned_to = ?'
    params.push(user.sub)
  } else {
    const filterMonitor = assigned_to || monitor_id
    if (filterMonitor) {
      query += ' AND t.assigned_to = ?'
      params.push(filterMonitor)
    }
  }

  if (status)    { query += ' AND t.status = ?';    params.push(status) }
  if (indicator) { query += ' AND t.indicator = ?'; params.push(indicator) }
  if (call_type) { query += ' AND t.call_type = ?'; params.push(call_type) }

  query += ' ORDER BY t.priority ASC, t.duration_sec DESC, t.created_at DESC LIMIT ? OFFSET ?'
  params.push(parseInt(limit), offset)

  const tasks = await c.env.DB.prepare(query).bind(...params).all()

  // Contagem total
  let countQuery = `
    SELECT COUNT(*) as total FROM tasks t WHERE 1=1
  `
  const countParams: any[] = []
  if (user.role === 'monitor') {
    countQuery += ' AND t.assigned_to = ?'
    countParams.push(user.sub)
  } else {
    const filterMonitor = assigned_to || monitor_id
    if (filterMonitor) { countQuery += ' AND t.assigned_to = ?'; countParams.push(filterMonitor) }
    if (status)    { countQuery += ' AND t.status = ?';    countParams.push(status) }
    if (indicator) { countQuery += ' AND t.indicator = ?'; countParams.push(indicator) }
    if (call_type) { countQuery += ' AND t.call_type = ?'; countParams.push(call_type) }
  }
  const count = await c.env.DB.prepare(countQuery).bind(...countParams).first<{ total: number }>()

  return c.json({
    data:  tasks.results,
    total: count?.total ?? 0,
    page:  parseInt(page),
    limit: parseInt(limit),
  })
})

// ─── GET /tasks/summary — resumo para distribuição ───────────────────────────
app.get('/summary', requireAdmin, async (c) => {
  const { import_id } = c.req.query()

  let q = `
    SELECT COUNT(*) as total,
           SUM(duration_sec) as total_sec,
           SUM(CASE WHEN call_type = 'phone' THEN 1 ELSE 0 END) as voice_count,
           SUM(CASE WHEN call_type = 'chat'  THEN 1 ELSE 0 END) as chat_count,
           SUM(CASE WHEN status = 'pending'  THEN 1 ELSE 0 END) as pending_count
    FROM tasks WHERE 1=1
  `
  const params: any[] = []
  if (import_id) { q += ' AND import_id = ?'; params.push(import_id) }

  const summary = await c.env.DB.prepare(q).bind(...params).first()
  return c.json(summary)
})

// ─── GET /tasks/:id — detalhes de uma task ────────────────────────────────────
app.get('/:id', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()

  const task = await c.env.DB.prepare(`
    SELECT t.*, o.name as operator_name, o.external_id as operator_code,
           o.team as operator_team,
           u.name as assigned_name, i.filename as import_filename
    FROM tasks t
    LEFT JOIN operators o ON t.operator_id = o.id
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN imports i ON t.import_id = i.id
    WHERE t.id = ?
  `).bind(id).first()

  if (!task) return c.json({ error: 'Tarefa não encontrada' }, 404)

  if (user.role === 'monitor' && (task as any).assigned_to !== user.sub) {
    return c.json({ error: 'Acesso negado' }, 403)
  }

  return c.json(task)
})

// ─── PATCH /tasks/:id/assign — atribuir a monitor (admin only) ────────────────
app.patch('/:id/assign', requireAdmin, async (c) => {
  const { id } = c.req.param()
  const { monitor_id } = await c.req.json()

  if (!monitor_id) return c.json({ error: 'monitor_id é obrigatório' }, 400)

  const monitor = await c.env.DB
    .prepare("SELECT id FROM users WHERE id = ? AND role = 'monitor' AND is_active = 1")
    .bind(monitor_id).first()
  if (!monitor) return c.json({ error: 'Monitor não encontrado ou inativo' }, 404)

  await c.env.DB.prepare(
    "UPDATE tasks SET assigned_to = ?, status = 'assigned', updated_at = datetime('now') WHERE id = ?"
  ).bind(monitor_id, id).run()

  return c.json({ message: 'Tarefa atribuída com sucesso' })
})

// ─── POST /tasks/bulk-assign — distribuição justa por minutagem ───────────────
app.post('/bulk-assign', requireAdmin, async (c) => {
  const { task_ids, monitor_ids, mode = 'balanced' } = await c.req.json()

  if (!task_ids?.length || !monitor_ids?.length) {
    return c.json({ error: 'task_ids e monitor_ids são obrigatórios' }, 400)
  }

  // Buscar tasks com duração para distribuiçã