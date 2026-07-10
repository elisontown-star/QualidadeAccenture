import { useEffect, useState } from 'react'
import { Search, Filter, Phone, MessageSquare, RefreshCw, ArrowRight } from 'lucide-react'
import { tasksApi } from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import clsx from 'clsx'

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending:     { label: 'Pendente',     cls: 'badge-pending'  },
  assigned:    { label: 'Atribuída',    cls: 'badge-assigned' },
  in_progress: { label: 'Em andamento', cls: 'badge-progress' },
  done:        { label: 'Concluída',    cls: 'badge-done'     },
  canceled:    { label: 'Cancelada',    cls: 'badge-canceled' },
}

// Destinos mais comuns da planilha Cielo
const DESTINATION_COLORS: Record<string, string> = {
  'Retenção':                  'bg-blue-100 text-blue-700',
  'Central De Relacionamento': 'bg-purple-100 text-purple-700',
  'S/ Fila de Destino':        'bg-gray-100 text-gray-500',
  'Antecipação':               'bg-yellow-100 text-yellow-700',
  'Suporte Técnico':           'bg-orange-100 text-orange-700',
  'E-commerce':                'bg-green-100 text-green-700',
}

function fmtDuration(sec: number | null) {
  if (!sec) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${m}min`
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtDate(raw: string | null) {
  if (!raw) return '—'
  return raw.split('T')[0].split(' ')[0]
}

export default function TasksPage() {
  const { user } = useAuthStore()
  const [tasks, setTasks]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filters, setFilters] = useState({ status: '', call_type: '' })
  const [page, setPage]       = useState(1)
  const [total, setTotal]     = useState(0)

  const load = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' }
      if (filters.status)    params.status    = filters.status
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
    !search ||
    t.call_id?.toLowerCase().includes(search.toLowerCase()) ||
    t.operator_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.operator_code?.toLowerCase().includes(search.toLowerCase()) ||
    t.destination_queue?.toLowerCase().includes(search.toLowerCase())
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
              placeholder="Buscar por ID, operador ou destino..."
              className="input pl-9"
            />
          </div>

          <select
            value={filters.status}
            onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1) }}
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
            value={filters.call_type}
            onChange={e => { setFilters(f => ({ ...f, call_type: e.target.value })); setPage(1) }}
            className="input w-auto"
          >
            <option value="">Voz + Chat</option>
            <option value="phone">Voz (ligação)</option>
            <option value="chat">Chat (WhatsApp)</option>
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
            {total} tarefa{total !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
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
                  {[
                    'ID da Ligação', 'Operador', 'Canal',
                    'Fila de Destino', 'Minutagem', 'Monitor', 'Status', 'Data',
                  ].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(task => (
                  <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                    {/* ID */}
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                        {task.call_id?.substring(0, 8)}…
                      </span>
                    </td>

                    {/* Operador */}
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-800 font-mono text-xs">
                        {task.operator_code || task.operator_name || '—'}
                      </span>
                    </td>

                    {/* Canal */}
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1.5 text-gray-600 text-xs">
                        {task.call_type === 'phone'
                          ? <><Phone className="w-3.5 h-3.5 text-primary-500" /> Voz</>
                          : <><MessageSquare className="w-3.5 h-3.5 text-green-500" /> Chat</>
                        }
                      </span>
                    </td>

                    {/* Fila de destino */}
                    <td className="py-3 px-4">
                      {task.destination_queue ? (
                        <span className={clsx(
                          'text-xs font-medium px-2 py-0.5 rounded-full',
                          DESTINATION_COLORS[task.destination_queue] || 'bg-gray-100 text-gray-600'
                        )}>
                          <ArrowRight className="w-3 h-3 inline mr-1" />
                          {task.destination_queue}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>

                    {/* Minutagem */}
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs text-gray-700 font-semibold">
                        {fmtDuration(task.duration_sec)}
                      </span>
                    </td>

                    {/* Monitor */}
                    <td className="py-3 px-4 text-gray-600 text-xs">
                      {task.assigned_name || <span className="text-gray-3