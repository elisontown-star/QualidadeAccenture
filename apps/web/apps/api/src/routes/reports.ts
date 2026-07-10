import { Hono } from 'hono'
import { Env } from '../index'

const app = new Hono<{ Bindings: Env }>()

// GET /reports/productivity — relatório de produtividade por monitor
app.get('/productivity', async (c) => {
  const { start_date, end_date, monitor_id } = c.req.query()
  const from = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const to = end_date || new Date().toISOString().split('T')[0]

  let query = `
    SELECT
      u.id as monitor_id, u.name as monitor_name,
      date(e.evaluated_at) as date,
      COUNT(e.id) as evaluations,
      SUM(COALESCE(t.duration_sec, 0)) / 60 as minutes_evaluated,
      SUM(CASE WHEN e.indicator = 'transfer' THEN 1 ELSE 0 END) as transfer_count,
      SUM(CASE WHEN e.indicator = 'nps' THEN 1 ELSE 0 END) as nps_count
    FROM evaluations e
    JOIN tasks t ON e.task_id = t.id
    JOIN users u ON e.evaluator_id = u.id
    WHERE e.status = 'completed'
      AND date(e.evaluated_at) BETWEEN ? AND ?
  `
  const params: any[] = [from, to]

  if (monitor_id) {
    query += ' AND u.id = ?'
    params.push(monitor_id)
  }

  query += ' GROUP BY u.id, u.name, date(e.evaluated_at) ORDER BY date DESC, evaluations DESC'

  const data = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ data: data.results, period: { from, to } })
})

// GET /reports/indicators — indicadores consolidados
app.get('/indicators', async (c) => {
  const { start_date, end_date, indicator } = c.req.query()
  const from = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const to = end_date || new Date().toISOString().split('T')[0]

  let query = `
    SELECT
      e.indicator,
      e.nps_model,
      e.result,
      COUNT(*) as count,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(PARTITION BY e.indicator, e.nps_model), 1) as percentage
    FROM evaluations e
    JOIN tasks t ON e.task_id = t.id
    WHERE e.status = 'completed' AND date(t.call_date) BETWEEN ? AND ?
  `
  const params: any[] = [from, to]

  if (indicator) {
    query += ' AND e.indicator = ?'
    params.push(indicator)
  }

  query += ' GROUP BY e.indicator, e.nps_model, e.result ORDER BY e.indicator, count DESC'

  const data = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ data: data.results, period: { from, to } })
})

// GET /reports/operators — desempenho por operador
app.get('/operators', async (c) => {
  const { start_date, end_date, indicator } = c.req.query()
  const from = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const to = end_date || new Date().toISOString().split('T')[0]

  const data = await c.env.DB.prepare(`
    SELECT
      o.id as operator_id, o.name as operator_name, o.team,
      COUNT(e.id) as total_evaluations,
      SUM(CASE WHEN e.result IN ('due','promoter') THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN e.result IN ('undue','detractor') THEN 1 ELSE 0 END) as negative,
      AVG(CASE WHEN e.indicator = 'nps' THEN e.score ELSE NULL END) as avg_nps,
      ROUND(
        SUM(CASE WHEN e.result IN ('due','promoter') THEN 1 ELSE 0 END) * 100.0 /
        NULLIF(COUNT(e.id), 0), 1
      ) as positive_rate
    FROM operators o
    JOIN tasks t ON t.operator_id = o.id
    JOIN evaluations e ON e.task_id = t.id
    WHERE e.status = 'completed' AND date(t.call_date) BETWEEN ? AND ?
    GROUP BY o.id, o.name, o.team
    ORDER BY total_evaluations DESC
  `).bind(from, to).all()

  return c.json({ data: data.results, period: { from, to } })
})

export const reportRoutes = app
