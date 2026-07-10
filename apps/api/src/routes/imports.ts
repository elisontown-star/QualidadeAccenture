import { Hono } from 'hono'
import { Env } from '../index'
import { requireAdmin } from '../middleware/auth'
import { generateId } from '../utils/id'

const app = new Hono<{ Bindings: Env }>()

function detectCallType(originQueue: string): 'phone' | 'chat' {
  const q = (originQueue || '').toUpperCase()
  if (q.includes('_W_') || q.includes('_WA_') || q.includes('WHATSAPP')) return 'chat'
  return 'phone'
}

function parseDate(raw: string): string {
  if (!raw) return new Date().toISOString().split('T')[0]
  if (raw.includes('-')) return raw.split(' ')[0].split('T')[0]
  const parts = raw.split('/')
  if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
  return raw
}

app.post('/', requireAdmin, async (c) => {
  const user = c.get('user')
  const formData = await c.req.formData()
  const file = formData.get('file') as File

  if (!file) return c.json({ error: 'Arquivo não enviado' }, 400)

  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
    'text/plain',
  ]
  if (!allowedTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
    return c.json({ error: 'Formato inválido. Envie .xlsx, .xls ou .csv' }, 400)
  }

  const importId = generateId('imp')
  await c.env.DB.prepare(
    "INSERT INTO imports (id, filename, imported_by, status) VALUES (?, ?, ?, 'processing')"
  ).bind(importId, file.name, user.sub).run()

  const { parseSpreadsheet } = await import('../utils/spreadsheet')
  let rows: Record<string, string>[]
  try {
    rows = await parseSpreadsheet(file)
  } catch (err) {
    await c.env.DB.prepare(
      "UPDATE imports SET status = 'error', error_log = ? WHERE id = ?"
    ).bind(JSON.stringify([String(err)]), importId).run()
    return c.json({ error: 'Erro ao processar arquivo: ' + String(err) }, 400)
  }

  if (rows.length === 0) {
    return c.json({ error: 'Planilha vazia ou sem linhas válidas' }, 400)
  }

  let tasksCreated = 0
  let skipped = 0
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    try {
      const row = rows[i]

      const callId = (
        row['ID Ligação'] || row['ID Ligacao'] || row['id_ligacao'] ||
        row['ID_CHAMADA']  || row['Call ID']
      )?.trim()

      const operatorCode = (
        row['Operadores'] || row['operadores'] || row['OPERADOR'] || row['Operador']
      )?.trim()

      const durationRaw = (
        row['Tempo de Ligação'] || row['Tempo de Ligacao'] ||
        row['DURACAO_SEG']      || row['Duration']
      )?.trim()
      const durationSec = parseInt(durationRaw || '0') || 0

      const originQueue = (
        row['Filas de Origem'] || row['Fila de Origem'] || row['FILA_ORIGEM']
      )?.trim() || ''

      const destinationQueue = (
        row['Filas de Destino'] || row['Fila de Destino'] || row['FILA_DESTINO']
      )?.trim() || ''

      const callDateRaw = (
        row['Data'] || row['data'] || row['DATA'] || row['Date']
      )?.trim()
      const callDate = parseDate(callDateRaw || '')

      const gIdUnico = (
        row['G ID Unico'] || row['G ID Único'] || row['g_id_unico']
      )?.trim() || ''

      if (!callId) {
        errors.push(`Linha ${i + 2}: ID da ligação não encontrado`)
        continue
      }

      const exists = await c.env.DB
        .prepare('SELECT id FROM tasks WHERE call_id = ?')
        .bind(callId)
        .first<{ id: string }>()

      if (exists) { skipped++; continue }

      let operatorId: string
      const existingOp = await c.env.DB
        .prepare('SELECT id FROM operators WHERE external_id = ?')
        .bind(operatorCode || 'DESCONHECIDO')
        .first<{ id: string }>()

      if (existingOp) {
        operatorId = existingOp.id
      } else {
        operatorId = generateId('opr')
        await c.env.DB
          .prepare('INSERT INTO operators (id, external_id, name) VALUES (?, ?, ?)')
          .bind(operatorId, operatorCode || 'DESCONHECIDO', operatorCode || 'Desconhecido')
          .run()
      }

      const taskId    = generateId('tsk')
      const callType  = detectCallType(originQueue)

      await c.env.DB.prepare(`
        INSERT INTO tasks (
          id, import_id, call_id, operator_id,
          indicator, call_type, duration_sec, call_date,
          origin_queue, destination_queue, g_id_unico,
          status, priority
        ) VALUES (?, ?, ?, ?, 'transfer', ?, ?, ?, ?, ?, ?, 'pending', 2)
      `).bind(
        taskId, importId, callId, operatorId,
        callType, durationSec, callDate,
        originQueue, destinationQueue, gIdUnico
      ).run()

      tasksCreated++
    } catch (err) {
      errors.push(`Linha ${i + 2}: ${String(err)}`)
    }
  }

  await c.env.DB.prepare(`
    UPDATE imports
    SET total_rows = ?, tasks_created = ?, errors = ?, error_log = ?, status = 'done'
    WHERE id = ?
  `).bind(rows.length, tasksCreated, errors.length, JSON.stringify(errors), importId).run()

  return c.json({
    import_id:     importId,
    total_rows:    rows.length,
    tasks_created: tasksCreated,
    skipped,
    errors:        errors.length,
    error_details: errors.slice(0, 20),
  }, 201)
})

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

app.get('/:id', requireAdmin, async (c) => {
  const { id } = c.req.param()
  const imp = await c.env.DB.prepare('SELECT * FROM imports WHERE id = ?').bind(id).first()
  if (!imp) return c.json({ error: 'Importação não encontrada' }, 404)
  return c.json(imp)
})

export const importRoutes = app
