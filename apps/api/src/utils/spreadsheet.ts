/**
 * Parser de planilhas para Cloudflare Workers
 * Suporta CSV (nativo) e XLSX (via sheetjs/xlsx)
 */

export async function parseSpreadsheet(file: File): Promise<Record<string, string>[]> {
  const filename = file.name.toLowerCase()

  if (filename.endsWith('.csv')) {
    return parseCSV(await file.text())
  }

  if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
    return parseXLSX(await file.arrayBuffer())
  }

  throw new Error(`Formato não suportado: ${file.name}`)
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  // Detectar separador (vírgula ou ponto-e-vírgula)
  const sep = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''))

  return lines.slice(1).map(line => {
    const values = splitCSVLine(line, sep)
    const row: Record<string, string> = {}
    headers.forEach((header, i) => {
      row[header] = (values[i] || '').trim().replace(/^"|"$/g, '')
    })
    return row
  }).filter(row => Object.values(row).some(v => v !== ''))
}

function splitCSVLine(line: string, sep: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === sep && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

async function parseXLSX(buffer: ArrayBuffer): Promise<Record<string, string>[]> {
  // Em ambiente Cloudflare Workers, usar @e965/xlsx ou xlsx com bundle
  // Importação dinâmica para evitar problemas de bundle size
  try {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, {
      raw: false,
      defval: '',
    })
    return data
  } catch {
    throw new Error(
      'Erro ao processar XLSX. Verifique se o arquivo não está corrompido ou protegido por senha.'
    )
  }
}
