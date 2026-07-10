import { useEffect, useState, useRef } from 'react'
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react'
import { importsApi } from '@/services/api'

function StatusBadge({ status }: { status: string }) {
  if (status === 'done') return (
    <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
      <CheckCircle className="w-3 h-3" /> Concluído
    </span>
  )
  if (status === 'error') return (
    <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2.5 py-1 rounded-full">
      <XCircle className="w-3 h-3" /> Erro
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
      <Clock className="w-3 h-3" /> Processando
    </span>
  )
}

export default function ImportsPage() {
  const [imports, setImports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadImports = async () => {
    try {
      const { data } = await importsApi.list()
      setImports(data.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadImports() }, [])

  const handleFile = async (file: File) => {
    if (!file) return
    setUploading(true)
    setResult(null)
    try {
      const { data } = await importsApi.upload(file)
      setResult({ success: true, ...data })
      loadImports()
    } catch (err: any) {
      setResult({ success: false, error: err.response?.data?.error || 'Erro ao importar' })
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className="space-y-6">
      {/* Upload */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Importar Planilha da Cielo</h3>

        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-400 hover:bg-gray-50'
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-3 text-primary-700">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-700" />
              <p className="font-medium">Processando planilha...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-gray-500">
              <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center">
                <Upload className="w-7 h-7 text-primary-700" />
              </div>
              <div>
                <p className="font-medium text-gray-700">Arraste o arquivo aqui ou clique para selecionar</p>
                <p className="text-xs text-gray-400 mt-1">Formatos aceitos: .xlsx, .xls, .csv</p>
              </div>
            </div>
          )}
        </div>

        {/* Resultado */}
        {result && (
          <div className={`mt-4 rounded-xl p-4 border ${result.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            {result.success ? (
              <div>
                <p className="font-semibold text-emerald-800 mb-2">✅ Importação concluída</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-white rounded-lg p-3 border border-emerald-100 text-center">
                    <p className="text-2xl font-bold text-gray-800">{result.total_rows}</p>
                    <p className="text-xs text-gray-500">Total de linhas</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-emerald-100 text-center">
                    <p className="text-2xl font-bold text-emerald-700">{result.tasks_created}</p>
                    <p className="text-xs text-gray-500">Tarefas criadas</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-emerald-100 text-center">
                    <p className="text-2xl font-bold text-red-600">{result.errors}</p>
                    <p className="text-xs text-gray-500">Erros</p>
                  </div>
                </div>
                {result.error_details?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-red-700 mb-1">Detalhes dos erros:</p>
                    <ul className="text-xs text-red-600 space-y-0.5 max-h-24 overflow-auto">
                      {result.error_details.map((e: string, i: number) => <li key={i}>• {e}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-red-700 text-sm font-medium">❌ {result.error}</p>
            )}
          </div>
        )}
      </div>

      {/* Colunas esperadas */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Colunas esperadas na planilha</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                {['Coluna', 'Obrigatório', 'Descrição'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-gray-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                ['ID_CHAMADA', '✅ Sim', 'ID único do atendimento no sistema Cielo'],
                ['OPERADOR', '✅ Sim', 'Nome do operador que realizou o atendimento'],
                ['DURACAO_SEG', 'Não', 'Duração do atendimento em segundos'],
                ['INDICADOR', 'Não', '"transfer" ou "nps" (padrão: transfer)'],
                ['TIPO', 'Não', '"phone" ou "chat" (padrão: phone)'],
                ['DATA', 'Não', 'Data do atendimento (YYYY-MM-DD)'],
              ].map(([col, req, desc]) => (
                <tr key={col}>
                  <td className="py-2 px-3 font-mono text-primary-700 font-medium">{col}</td>
                  <td className="py-2 px-3">{req}</td>
                  <td className="py-2 px-3 text-gray-500">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Histórico */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Histórico de Importações</span>
          <button onClick={loadImports} className="text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-700" />
          </div>
        ) : imports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <FileSpreadsheet className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Nenhuma importação realizada ainda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Arquivo', 'Data', 'Importado por', 'Total', 'Criadas', 'Erros', 'Status'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {imports.map(imp => (
                  <tr key={imp.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-800 max-w-xs truncate">{imp.filename}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{new Date(imp.created_at).toLocaleString('pt-BR')}</td>
                    <td className="py-3 px-4 text-gray-600">{imp.imported_by_name}</td>
                    <td className="py-3 px-4 text-gray-600">{imp.total_rows}</td>
                    <td className="py-3 px-4 text-emerald-600 font-medium">{imp.tasks_created}</td>
                    <td className="py-3 px-4 text-red-500">{imp.errors}</td>
                    <td className="py-3 px-4"><StatusBadge status={imp.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
