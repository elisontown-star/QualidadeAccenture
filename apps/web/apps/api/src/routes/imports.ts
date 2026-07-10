import { Hono } from 'hono'
import { Env } from '../index'
import { requireAdmin } from '../middleware/auth'
import { generateId } from '../utils/id'

const app = new Hono<{ Bindings: Env }>()

// POST /imports — processar upload de planilha (admin only)
app.post('/', requireAdmin, async (c) => {
  const user = c.get('user')
  const formData = await c.req.formData()
  const file = formData.get('file') as File

  if (!file) return c.json({ error: 'Arquivo não enviado' }, 400)

  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
  ]
  if (!allowedTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
    return c.json({ error: 'Formato inválido. Envie .xlsx, .xls ou .csv' }, 400)
  }

  const importId = generateId('imp')
  await c.env.DB.prepare(
    'INSERT INTO imports (id, filename, imported_by, status) VALUES (?, ?, ?, \'processing\')'
  ).bind(importId, file.name, user.sub).run()

  // Processar arquivo
  // Para XLSX: usar sheetjs (xlsx) no Worker
  // Para CSV: usar parser nativo
  const { parseSpreadsheet } = await import('../utils/spreadsheet')
  const rows = await parseSpreadsheet(file)

  let tasksCreated = 0
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    try {
      const row = rows[i]

      // Colunas obrigatórias esperadas da planilha Cielo
      const callId = row['ID_CHAMADA'] || row['id_chamada'] || row['Call ID']
      const operatorName = row['OPERADOR'] || row['operador'] || row['Operator']
      const durationSec = parseInt(row['DURACAO_SEG'] || row['duracao_seg'] || row['Duration'] || '0')
      const indicator = (row['INDICADOR'] || row['indicador'] || 'transfer').toLowerCase()
      const callType = (row['TIPO'] || row['tipo'] || 'phone').toLowerCase()
      const callDate = row['DATA'] || row['data'] || row['Date'] || new Date().toISOString().split('T')[0]

      if (!callId) {
        errors.push(`Linha ${i + 2}: ID da chamada não encontrado`)
        continue
      }

      // Upsert do operador
      let operatorId: string
      const existing = await c.env.DB
        .prepare('SELECT id FROM operators WHERE name = ?')
        .bind(operatorName || 'Desconhecido')
        .first<{ id: string }>()

      if (existing) {
        operatorId = existing.id
      } else {
        operatorId = generateId('opr')
        await c.env.DB
          .prepare('INSERT INTO operators (id, name) VALUES (?, ?)')
          .bind(operatorId, operatorName || 'Desconhecido')
          .run()
      }

      // Criar task
      const taskId = generateId('tsk')
      const extraData = JSON.stringify(
        Object.fromEntries(
          Object.entries(row).filter(([k]) =>
            !['ID_CHAMADA','OPERADOR','DURACAO_SEG','INDICADOR','TIPO','DATA',
              'id_chamada','operador','duracao_seg','indicador','tipo','data'].includes(k)
          )
        )
      )

      await c.env.DB.prepare(`
        INSERT INTO tasks (id, import_id, call_id, operator_id, indicator, call_type, duration_sec, call_date, extra_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        taskId, importId, String(callId), operatorId,
        indicator.includes('nps') ? 'nps' : 'transfer',
        callType.includes('chat') ? 'chat' : 'phone',
        durationSec, callDate, extraData
      ).run()

      tasksCreated++
    } catch (err) {
      errors.push(`Linha ${i + 2}: ${String(err)}`)
    }
  }

  // Atualizar registro de importação
  await c.env.DB.prepare(`
    UPDATE imports
    SET total_rows = ?, tasks_created = ?, errors = ?, error_log = ?, status = 'done'
    WHERE id = ?
  `).bind(rows.length, tasksCreated, errors.length, JSON.stringify(errors), importId).run()

  return c.json({
    import_id: importId,
    total_rows: rows.length,
    tasks_created: tasksCreated,
    errors: errors.length,
    error_details: errors.slice(0, 20), // primeiros 20 erros
  }, 201)
})

// GET /imports — histórico de importações (admin only)
app.get('/', requireAdmin, async (c) => {
  const imports = await c.env.DB.prepare(`
    SELECT i.*, u.name as imported_by_name
    FROM imports i
    LEFT JOIN users u ON i.imported_by = u.id
    ORDER BY i.created_at DESC
    LIMIT 50
  `).all()
  return c.json({ data: imports.results })
})

// GET /imports/:id — detalhes de uma importação
app.get('/:id', requireAdmin, async (c) => {
  const { id } = c.req.param()
  const imp = await c.env.DB
    .prepare('SELECT * FROM imports WHERE id = ?')
    .bind(id).first()
  if (!imp) return c.json({ error: 'Importação não encontrada' }, 404)
  return c.json(imp)
})

export const importRoutes = app
