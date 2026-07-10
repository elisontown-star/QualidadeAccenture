import { Hono } from 'hono'
import { Env } from '../index'

const app = new Hono<{ Bindings: Env }>()

// GET /dashboard/summary — KPIs principais
app.get('/summary', async (c) => {
  const { start_date, end_date } = c.req.query()
  const from = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const to = end_date || new Date().toISOString().split('T')[0]

  const [tasks, evaluations, monitors] = await Promise.all([
    c.env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN status = 'canceled' THEN 1 ELSE 0 END) as canceled,
        SUM(CASE WHEN due_date < date('now') AND status != 'done' THEN 1 ELSE 0 END) as overdue,
        SUM(COALESCE(duration_sec, 0)) as total_seconds
      FROM tasks
      WHERE date(created_at) BETWEEN ? AND ?
    `).bind(from, to).first(),

    c.env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN indicator = 'transfer' AND result = 'undue' THEN 1 ELSE 0 END) as transfer_undue,
        SUM(CASE WHEN indicator = 'transfer' AND result = 'due' THEN 1 ELSE 0 END) as transfer_due,
        SUM(CASE WHEN indicator = 'nps' AND result = 'promoter' THEN 1 ELSE 0 END) as nps_promoter,
        SUM(CASE WHEN indicator = 'nps' AND result = 'neutral' THEN 1 ELSE 0 END) as nps_neutral,
        SUM(CASE WHEN indicator = 'nps' AND result = 'detractor' THEN 1 ELSE 0 END) as nps_detractor,
        AVG(CASE WHEN indicator = 'nps' THEN score ELSE NULL END) as avg_nps_score
      FROM evaluations e
      JOIN tasks t ON e.task_id = t.id
      WHERE date(t.created_at) BETWEEN ? AND ?
    `).bind(from, to).first(),

    c.env.DB.prepare(`
      SELECT COUNT(DISTINCT assigned_to) as active_monitors
      FROM tasks
      WHERE status IN ('assigned','in_progress') AND date(created_at) BETWEEN ? AND ?
    `).bind(from, to).first(),
  ])

  const tasksData = tasks as any
  const evalData = evaluations as any
  const totalMinutes = Math.floor((tasksData?.total_seconds ?? 0) / 60)

  return c.json({
    period: { from, to },
    tasks: {
      total: tasksData?.total ?? 0,
      pending: tasksData?.pending ?? 0,
      in_progress: tasksData?.in_progress ?? 0,
      done: tasksData?.done ?? 0,
      canceled: tasksData?.canceled ?? 0,
      overdue: tasksData?.overdue ?? 0,
      total_minutes_evaluated: totalMinutes,
    },
    evaluations: {
      total: evalData?.total ?? 0,
      completed: evalData?.completed ?? 0,
      transfer_due: evalData?.transfer_due ?? 0,
      transfer_undue: evalData?.transfer_undue ?? 0,
      nps_promoter: evalData?.nps_promoter ?? 0,
      nps_neutral: evalData?.nps_neutral ?? 0,
      nps_detractor: evalData?.nps_detractor ?? 0,
      avg_nps_score: evalData?.avg_nps_score ?? null,
    },
    monitors: { active: (monitors as any)?.active_monitors ?? 0 },
  })
})

// GET /dashboard/daily — volume diário de tarefas e avaliações
app.get('/daily', async (c) => {
  const { days = '30' } = c.req.query()
  const numDays = parseInt(days)

  const data = await c.env.DB.prepare(`
    SELECT
      date(t.created_at) as date,
      COUNT(DISTINCT t.id) as tasks_created,
      COUNT(DISTINCT e.id) as evaluations_done,
      SUM(COALESCE(t.duration_sec, 0)) / 60 as minutes_evaluated
    FROM tasks t
    LEFT JOIN evaluations e ON e.task_id = t.id AND e.status = 'completed'
    WHERE t.created_at >= datetime('now', '-${numDays} days')
    GROUP BY date(t.created_at)
    ORDER BY date ASC
  `).all()

  return c.json({ data: data.results })
})

// GET /dashboard/monitors — ranking de monitores
app.get('/monitors', async (c) => {
  const { start_date, end_date } = c.req.query()
  const from = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const to = end_date || new Date().toISOString().split('T')[0]

  const data = await c.env.DB.prepare(`
    SELECT
      u.id, u.name,
      COUNT(DISTINCT t.id) as tasks_assigned,
      COUNT(DISTINCT e.id) as evaluations_done,
      SUM(CASE WHEN t.status = 'pending' OR t.status = 'in_progress' THEN 1 ELSE 0 END) as pending,
      SUM(COALESCE(t.duration_sec, 0)) / 60 as minutes_evaluated,
      ROUND(COUNT(DISTINCT e.id) * 100.0 / NULLIF(COUNT(DISTINCT t.id), 0), 1) as completion_rate
    FROM users u
    LEFT JOIN tasks t ON t.assigned_to = u.id AND date(t.created_at) BETWEEN ? AND ?
    LEFT JOIN evaluations e ON e.task_id = t.id AND e.status = 'completed'
    WHERE u.role = 'monitor' AND u.is_active = 1
    GROUP BY u.id, u.name
    ORDER BY evaluations_done DESC
  `).bind(from, to).all()

  return c.json({ data: data.results, period: { from, to } })
})

// GET /dashboard/nps-trend — tendência NPS
app.get('/nps-trend', async (c) => {
  const { weeks = '12' } = c.req.query()

  const data = await c.env.DB.prepare(`
    SELECT
      strftime('%Y-W%W', t.call_date) as week,
      COUNT(*) as total,
      SUM(CASE WHEN e.result = 'promoter' THEN 1 ELSE 0 END) as promoters,
      SUM(CASE WHEN e.result = 'neutral' THEN 1 ELSE 0 END) as neutrals,
      SUM(CASE WHEN e.result = 'detractor' THEN 1 ELSE 0 END) as detractors,
      AVG(e.score) as avg_score
    FROM evaluations e
    JOIN tasks t ON e.task_id = t.id
    WHERE e.indicator = 'nps' AND e.status = 'completed'
      AND t.call_date >= date('now', '-${parseInt(weeks)} weeks')
    GROUP BY week
    ORDER BY week ASC
  `).all()

  return c.json({ data: data.results })
})

export const dashboardRoutes = app
