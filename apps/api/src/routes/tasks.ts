import { Hono } from 'hono'
import { Env } from '../index'
import { requireAdmin, requireAdminOrMonitor } from '../middleware/auth'

const app = new Hono<{ Bindings: Env }>()

// GET /tasks
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

  if (user.role === 'monitor') {
    query += ' AND t.assigned_to = ?'
    params.push(user.sub)
  } else {
    const filterMonitor = assigned_to || monitor_id
    if (filterMonitor) { query += ' AND t.assigned_to = ?'; params.push(filterMonitor) }
  }

  if (status)    { query += ' AND t.status = ?';    params.push(status) }
  if (indicator) { query += ' AND t.indicator = ?'; params.push(indicator) }
  if (call_type) { query += ' AND t.call_type = ?'; params.push(call_type) }

  query += ' ORDER BY t.priority ASC, t.duration_sec DESC, t.created_at DESC LIMIT ? OFFSET ?'
  params.push(parseInt(limit), offset)

  const tasks = await c.env.DB.prepare(query).bind(...params).all()

  let countQuery = 'SELECT COUNT(*) as total FROM tasks t WHERE 1=1'
  const countParams: any[] = []
  if (user.role === 'monitor') {
    countQuery += ' AND t.assigned_to = ?'; countParams.push(user.sub)
  } else {
    const fm = assigned_to || monitor_id
    if (fm)        { countQuery += ' AND t.assigned_to = ?'; countParams.push(fm) }
    if (status)    { countQuery += ' AND t.status = ?';      countParams.push(status) }
    if (indicator) { countQuery += ' AND t.indicator = ?';   countParams.push(indicator) }
    if (call_type) { countQuery += ' AND t.call_type = ?';   countParams.push(call_type) }
  }
  const count = await c.env.DB.prepare(countQuery).bind(...countParams).first<{ total: number }>()

  return c.json({ data: tasks.results, total: count?.total ?? 0, page: parseInt(page), limit: parseInt(limit) })
})

// GET /tasks/:id
app.get('/:id', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const task = await c.env.DB.prepare(`
    SELECT t.*, o.name as operator_name, o.external_id as operator_code,
           o.team as operator_team, u.name as assigned_name, i.filename as import_filename
    FROM tasks t
    LEFT JOIN operators o ON t.operator_id = o.id
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN imports i ON t.import_id = i.id
    WHERE t.id = ?
  `).bind(id).first()
  if (!task) return c.json({ error: 'Tarefa não encontrada' }, 404)
  if (user.role === 'monitor' && (task as any).assigned_to !== user.sub)
    return c.json({ error: 'Acesso negado' }, 403)
  return c.json(task)
})

// PATCH /tasks/:id/assign
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

// POST /tasks/bulk-assign — distribuição justa por minutagem (LPT)
app.post('/bulk-assign', requireAdmin, async (c) => {
  const { task_ids, monitor_ids, mode = 'balanced' } = await c.req.json()
  if (!task_ids?.length || !monitor_ids?.length)
    return c.json({ error: 'task_ids e monitor_ids são obrigatórios' }, 400)

  const placeholders = task_ids.map(() => '?').join(',')
  const result = await c.env.DB
    .prepare(`SELECT id, duration_sec FROM tasks WHERE id IN (${placeholders}) ORDER BY duration_sec DESC`)
    .bind(...task_ids)
    .all<{ id: string; duration_sec: number }>()
  const items = result.results
  let assigned = 0

  if (mode === 'balanced') {
    const load: Record<string, number> = {}
    for (const mid of monitor_ids) load[mid] = 0
    for (const task of items) {
      let minMon = monitor_ids[0]
      for (const mid of monitor_ids) { if (load[mid] < load[minMon]) minMon = mid }
      await c.env.DB.prepare(
        "UPDATE tasks SET assigned_to = ?, status = 'assigned', updated_at = datetime('now') WHERE id = ?"
      ).bind(minMon, task.id).run()
      load[minMon] += (task.duration_sec || 0)
      assigned++
    }
    const distribution: Record<string, number> = {}
    for (const [k, v] of Object.entries(load)) distribution[k] = Math.round(v / 60)
    return c.json({ message: `${assigned} tarefas distribuídas`, assigned, distribution_min: distribution })
  }

  for (let i = 0; i < items.length; i++) {
    await c.env.DB.prepare(
      "UPDATE tasks SET assigned_to = ?, status = 'assigned', updated_at = datetime('now') WHERE id = ?"
    ).bind(monitor_ids[i % monitor_ids.length], items[i].id).run()
    assigned++
  }
  return c.json({ message: `${assigned} tarefas distribuídas`, assigned })
})

// PATCH /tasks/:id/status
app.patch('/:id/status', requireAdminOrMonitor, async (c) => {
  const { id } = c.req.param()
  const { status } = await c.req.json()
  const user = c.get('user')
  const allowed = ['pending','assigned','in_progress','done','canceled']
  if (!allowed.includes(status)) return c.json({ error: 'Status inválido' }, 400)
  const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first<any>()
  if (!task) return c.json({ error: 'Tarefa não encontrada' }, 404)
  if (user.role === 'monitor' && task.assigned_to !== user.sub)
    return c.json({ error: 'Acesso negado' }, 403)
  await c.env.DB.prepare(
    "UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(status, id).run()
  return c.json({ message: 'Status atualizado' })
})

// DELETE /tasks/:id
app.delete('/:id', requireAdmin, async (c) => {
  const { id } = c.req.param()
  const { reason } = await c.req.json().catch(() => ({ reason: '' }))
  await c.env.DB.prepare(
    "UPDATE tasks SET status = 'canceled', cancel_reason = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(reason ?? '', id).run()
  return c.json({ message: 'Tarefa cancelada' })
})

export const taskRoutes = app
