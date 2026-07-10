import { Hono } from 'hono'
import { Env } from '../index'
import { requireAdminOrMonitor } from '../middleware/auth'
import { generateId } from '../utils/id'

const app = new Hono<{ Bindings: Env }>()

// POST /evaluations — criar ou salvar rascunho
app.post('/', requireAdminOrMonitor, async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const { task_id, indicator, nps_model, result, score, notes, items = [], status = 'draft' } = body

  if (!task_id || !indicator) {
    return c.json({ error: 'task_id e indicator são obrigatórios' }, 400)
  }

  // Verifica se task existe e está atribuída ao monitor
  const task = await c.env.DB
    .prepare('SELECT * FROM tasks WHERE id = ?')
    .bind(task_id).first<any>()

  if (!task) return c.json({ error: 'Tarefa não encontrada' }, 404)
  if (user.role === 'monitor' && task.assigned_to !== user.sub) {
    return c.json({ error: 'Acesso negado' }, 403)
  }

  // Verificar se já existe avaliação para esta task
  const existing = await c.env.DB
    .prepare('SELECT id, status FROM evaluations WHERE task_id = ?')
    .bind(task_id).first<{ id: string; status: string }>()

  if (existing?.status === 'completed') {
    return c.json({ error: 'Esta tarefa já foi avaliada e não pode ser alterada' }, 409)
  }

  const evalId = existing?.id ?? generateId('evl')
  const now = new Date().toISOString()

  if (existing) {
    await c.env.DB.prepare(`
      UPDATE evaluations
      SET indicator=?, nps_model=?, result=?, score=?, notes=?, status=?,
          evaluated_at=CASE WHEN ? = 'completed' THEN ? ELSE evaluated_at END,
          updated_at=?
      WHERE id=?
    `).bind(indicator, nps_model ?? null, result ?? null, score ?? null, notes ?? null,
       status, status, now, now, evalId).run()
  } else {
    await c.env.DB.prepare(`
      INSERT INTO evaluations (id, task_id, evaluator_id, indicator, nps_model, result, score, notes, status, evaluated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(evalId, task_id, user.sub, indicator, nps_model ?? null, result ?? null,
       score ?? null, notes ?? null, status, status === 'completed' ? now : null).run()
  }

  // Upsert dos itens de avaliação
  if (items.length > 0) {
    await c.env.DB.prepare('DELETE FROM evaluation_items WHERE evaluation_id = ?').bind(evalId).run()
    for (const item of items) {
      await c.env.DB.prepare(`
        INSERT INTO evaluation_items (id, evaluation_id, criterion_id, criterion_name, answer, weight, points)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        generateId('eit'), evalId, item.criterion_id, item.criterion_name,
        item.answer, item.weight ?? 1.0, item.points ?? 0.0
      ).run()
    }
  }

  // Se concluída, atualizar status da task para 'done'
  if (status === 'completed') {
    await c.env.DB.prepare(
      'UPDATE tasks SET status = \'done\', updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(task_id).run()
  } else if (task.status === 'assigned') {
    // Marcar como em andamento ao salvar rascunho
    await c.env.DB.prepare(
      'UPDATE tasks SET status = \'in_progress\', updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(task_id).run()
  }

  return c.json({ id: evalId, status }, existing ? 200 : 201)
})

// GET /evaluations/:id — detalhe de avaliação
app.get('/:id', async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')

  const evaluation = await c.env.DB.prepare(`
    SELECT e.*, t.call_id, t.operator_id, o.name as operator_name,
           u.name as evaluator_name
    FROM evaluations e
    LEFT JOIN tasks t ON e.task_id = t.id
    LEFT JOIN operators o ON t.operator_id = o.id
    LEFT JOIN users u ON e.evaluator_id = u.id
    WHERE e.id = ?
  `).bind(id).first<any>()

  if (!evaluation) return c.json({ error: 'Avaliação não encontrada' }, 404)
  if (user.role === 'monitor' && evaluation.evaluator_id !== user.sub) {
    return c.json({ error: 'Acesso negado' }, 403)
  }

  const items = await c.env.DB
    .prepare('SELECT * FROM evaluation_items WHERE evaluation_id = ?')
    .bind(id).all()

  return c.json({ ...evaluation, items: items.results })
})

// POST /evaluations/:id/submit — submeter avaliação final
app.post('/:id/submit', requireAdminOrMonitor, async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')
  const now = new Date().toISOString()

  const evaluation = await c.env.DB
    .prepare('SELECT * FROM evaluations WHERE id = ?')
    .bind(id).first<any>()

  if (!evaluation) return c.json({ error: 'Avaliação não encontrada' }, 404)
  if (user.role === 'monitor' && evaluation.evaluator_id !== user.sub) {
    return c.json({ error: 'Acesso negado' }, 403)
  }
  if (evaluation.status === 'completed') {
    return c.json({ error: 'Avaliação já concluída' }, 409)
  }
  if (!evaluation.result) {
    return c.json({ error: 'Resultado da avaliação é obrigatório para submissão' }, 400)
  }

  await c.env.DB.prepare(
    'UPDATE evaluations SET status = \'completed\', evaluated_at = ?, updated_at = ? WHERE id = ?'
  ).bind(now, now, id).run()

  await c.env.DB.prepare(
    'UPDATE tasks SET status = \'done\', updated_at = datetime(\'now\') WHERE id = ?'
  ).bind(evaluation.task_id).run()

  return c.json({ message: 'Avaliação concluída com sucesso', evaluated_at: now })
})

export const evaluationRoutes = app
