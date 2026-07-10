import { useEffect, useState } from 'react'
import { Search, Filter, Phone, MessageSquare, RefreshCw } from 'lucide-react'
import { tasksApi } from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import clsx from 'clsx'

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending:     { label: 'Pendente',    cls: 'badge-pending' },
  assigned:    { label: 'Atribuída',   cls: 'badge-assigned' },
  in_progress: { label: 'Em andamento', cls: 'badge-progress' },
  done:        { label: 'Concluída',   cls: 'badge-done' },
  canceled:    { label: 'Cancelada',   cls: 'badge-canceled' },
}

const INDICATOR_LABELS: Record<string, string> = {
  transfer: 'Transferência',
  nps: 'NPS',
}

function fmtDuration(sec: number | null) {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function TasksPage() {
  const { user } = useAuthStore()
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ status: '', indicator: '', call_type: '' })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' }
      if (filters.status) params.status = filters.status
      if (filters.indicator) params.indicator = filters.indicator
      if (filters.call_type) params.call_type = filters.call_type
      const { data } = await tasksApi.list(params)
      setTasks(data.data || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, filters])

  const filtered = tasks.filter(t =>
    !search || t.call_id?.toLowerCase().includes(search.toLowerCase()) ||
    t.operator_name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por ID ou operador..."
              className="input pl-9"
            />
          </div>

          <select
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            className="input w-auto"
          >
            <option value="">Todos os status</option>
            <option value="pending">Pendente</option>
            <option value="assigned">Atribuída</option>
            <option value="in_progress">Em andamento</option>
            <option value="done">Concluída</option>
            <option value="canceled">Cancelada</option>
          </select>

          <select
            value={filters.indicator}
            onChange={e => setFilters(f => ({ ...f, indicator: e.target.value }))}
            className="input w-auto"
          >
            <option value="">Todos os indicadores</option>
            <option value="transfer">Transferência</option>
            <option value="nps">NPS</option>
          </select>

          <select
            value={filters.call_type}
            onChange={e => setFilters(f => ({ ...f, call_type: e.target.value }))}
            className="input w-auto"
          >
            <option value="">Todos os tipos</option>
            <option value="phone">Ligação</option>
            <option value="chat">Chat</option>
          </select>

          <button onClick={load} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            {total} tarefa{total !== 1 ? 's' : ''} encontrada{total !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-700" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Filter className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Nenhuma tarefa encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['ID da Chamada', 'Operador', 'Tipo', 'Indicador', 'Duração', 'Monitor', 'Status', 'Data'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(task => (
                  <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                        {task.call_id}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-800">{task.operator_name || '—'}</td>
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1 text-gray-600">
                        {task.call_type === 'phone'
                          ? <><Phone className="w-3.5 h-3.5" /> Ligação</>
                          : <><MessageSquare className="w-3.5 h-3.5" /> Chat</>
                        }
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full',
                        task.indicator === 'nps'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      )}>
                        {INDICATOR_LABELS[task.indicator] || task.indicator}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 font-mono text-xs">{fmtDuration(task.duration_sec)}</td>
                    <td className="py-3 px-4 text-gray-600">{task.assigned_name || <span className="text-gray-300">Não atribuído</span>}</td>
                    <td className="py-3 px-4">
                      <span className={STATUS_LABELS[task.status]?.cls || 'badge-pending'}>
                        {STATUS_LABELS[task.status]?.label || task.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{task.call_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {total > 20 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">Página {page} de {Math.ceil(total / 20)}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs py-1 px-3">Anterior</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} className="btn-secondary text-xs py-1 px-3">Próxima</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
