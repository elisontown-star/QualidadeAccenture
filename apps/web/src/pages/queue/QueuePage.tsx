import { useEffect, useState, useCallback } from 'react'
import { Mic, MessageSquare, RefreshCw, Clock, AlertTriangle, User, ChevronRight } from 'lucide-react'
import { tasksApi, usersApi } from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import clsx from 'clsx'

const PRIORITY_MAP: Record<string, { label: string; cls: string; showIcon: boolean }> = {
  high:   { label: 'Alta',   cls: 'bg-red-100 text-red-700',       showIcon: true  },
  medium: { label: 'Média',  cls: 'bg-yellow-100 text-yellow-700', showIcon: false },
  normal: { label: 'Normal', cls: 'bg-green-100 text-green-700',   showIcon: false },
}

const INDICATOR_LABELS: Record<string, string> = {
  transfer: 'Transferência',
  nps: 'NPS',
}

function waitTime(dateStr: string) {
  if (!dateStr) return '—'
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (diff < 1) return '< 1 min'
  if (diff < 60) return `${diff} min`
  return `${Math.floor(diff / 60)}h ${diff % 60}min`
}

function waitClass(dateStr: string) {
  if (!dateStr) return 'text-gray-400'
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (diff >= 30) return 'text-red-600 font-semibold'
  if (diff >= 15) return 'text-yellow-600'
  return 'text-gray-600'
}

function priorityFromWait(dateStr: string): string {
  if (!dateStr) return 'normal'
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (diff >= 30) return 'high'
  if (diff >= 15) return 'medium'
  return 'normal'
}

export default function QueuePage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin' || user?.role === 'coordinator'

  const [tab, setTab] = useState<'voice' | 'chat'>('voice')
  const [voiceTasks, setVoiceTasks] = useState<any[]>([])
  const [chatTasks, setChatTasks] = useState<any[]>([])
  const [monitors, setMonitors] = useState<any[]>([])
  const [selectedMonitor, setSelectedMonitor] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { status: 'assigned', limit: '50' }
      if (selectedMonitor) params.assigned_to = selectedMonitor

      const [voiceRes, chatRes] = await Promise.all([
        tasksApi.list({ ...params, call_type: 'phone' }),
        tasksApi.list({ ...params, call_type: 'chat' }),
      ])
      setVoiceTasks(voiceRes.data?.data || [])
      setChatTasks(chatRes.data?.data || [])
    } finally {
      setLoading(false)
    }
  }, [selectedMonitor])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (isAdmin) {
      usersApi.list({ role: 'monitor' })
        .then(res => setMonitors(res.data?.data || res.data || []))
        .catch(() => {})
    }
  }, [isAdmin])

  const tasks = tab === 'voice' ? voiceTasks : chatTasks

  const stats = {
    waiting:    tasks.length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    high:       tasks.filter(t => priorityFromWait(t.updated_at) === 'high').length,
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Fila de atendimento</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isAdmin ? 'Visão geral de todos os monitores' : `Monitor: ${user?.name}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <select
              value={selectedMonitor}
              onChange={e => setSelectedMonitor(e.target.value)}
              className="input w-auto text-sm"
            >
              <option value="">Todos os monitores</option>
              {monitors.map((m: any) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
          <button onClick={load} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Aguardando avaliação</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.waiting}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Em andamento</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.inProgress}</p>
        </div>
        <div className={clsx('card p-4', stats.high > 0 && 'border-red-200 bg-red-50')}>
          <p className={clsx('text-xs mb-1', stats.high > 0 ? 'text-red-600' : 'text-gray-500')}>
            Prioridade alta
          </p>
          <p className={clsx('text-2xl font-semibold', stats.high > 0 ? 'text-red-700' : 'text-gray-900')}>
            {stats.high}
          </p>
        </div>
      </div>

      {/* Abas + lista */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-100">
          <div className="flex">
            {[
              { key: 'voice', icon: Mic,           label: 'Voz / transcrição', count: voiceTasks.length },
              { key: 'chat',  icon: MessageSquare, label: 'Chat / mensagem',   count: chatTasks.length  },
            ].map(({ key, icon: Icon, label, count }) => (
              <button
                key={key}
                onClick={() => setTab(key as 'voice' | 'chat')}
                className={clsx(
                  'flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors',
                  tab === key
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
                <span className={clsx(
                  'text-xs px-2 py-0.5 rounded-full',
                  tab === key ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
                )}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-700" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            {tab === 'voice'
              ? <Mic className="w-10 h-10 mb-2 opacity-30" />
              : <MessageSquare className="w-10 h-10 mb-2 opacity-30" />}
            <p className="text-sm">Nenhum item na fila</p>
          </div>
        ) : (
          <>
            {/* Cabeçalho da tabela */}
            <div className="flex items-center gap-4 px-5 py-2 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <span className="w-28 shrink-0">ID</span>
              <span className="flex-1">Operador</span>
              {isAdmin && <span className="w-32 shrink-0">Monitor</span>}
              <span className="w-24 shrink-0">Espera</span>
              <span className="w-20 shrink-0 text-center">Prioridade</span>
              <span className="w-20 shrink-0 text-right">Ação</span>
            </div>

            <div className="divide-y divide-gray-50">
              {tasks.map(task => {
                const priority = priorityFromWait(task.updated_at)
                const p = PRIORITY_MAP[priority]
                return (
                  <div
                    key={task.id}
                    className={clsx(
                      'flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors',
                      priority === 'high' && 'border-l-2 border-red-400'
                    )}
                  >
                    <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded w-28 shrink-0 truncate">
                      {task.call_id}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{task.operator_name || '—'}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {INDICATOR_LABELS[task.indicator] || task.indicator || '—'}
                      </p>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 w-32 shrink-0">
                        <User className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{task.assigned_name || 'Não atribuído'}</span>
                      </div>
                    )}

                    <div className={clsx('flex items-center gap-1.5 text-xs w-24 shrink-0', waitClass(task.updated_at))}>
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      {waitTime(task.updated_at)}
                    </div>

                    <span className={clsx('text-xs font-medium px-2.5 py-0.5 rounded-full w-20 text-center shrink-0 flex items-center justify-center gap-1', p.cls)}>
                      {p.showIcon && <AlertTriangle className="w-3 h-3 shrink-0" />}
                      {p.label}
                    </span>

                    <button className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 shrink-0 w-20 justify-center">
                      Avaliar
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}