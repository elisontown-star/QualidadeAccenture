import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  ClipboardList, CheckCircle, Clock, AlertTriangle,
  Timer, TrendingUp, Users, Activity
} from 'lucide-react'
import { dashboardApi } from '@/services/api'

interface Summary {
  tasks: { total: number; pending: number; in_progress: number; done: number; overdue: number; total_minutes_evaluated: number }
  evaluations: { completed: number; transfer_due: number; transfer_undue: number; nps_promoter: number; nps_neutral: number; nps_detractor: number }
  monitors: { active: number }
}

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-800 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const COLORS = ['#3949ab', '#ef4444', '#10b981', '#f59e0b', '#6366f1']

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [daily, setDaily] = useState<any[]>([])
  const [monitors, setMonitors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      dashboardApi.summary(),
      dashboardApi.daily(30),
      dashboardApi.monitors(),
    ]).then(([s, d, m]) => {
      setSummary(s.data)
      setDaily(d.data.data || [])
      setMonitors(m.data.data || [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700" />
    </div>
  )

  const transferData = summary ? [
    { name: 'Devida', value: summary.evaluations.transfer_due },
    { name: 'Indevida', value: summary.evaluations.transfer_undue },
  ] : []

  const npsData = summary ? [
    { name: 'Promotor', value: summary.evaluations.nps_promoter, color: '#10b981' },
    { name: 'Neutro', value: summary.evaluations.nps_neutral, color: '#f59e0b' },
    { name: 'Detrator', value: summary.evaluations.nps_detractor, color: '#ef4444' },
  ] : []

  const hours = Math.floor((summary?.tasks.total_minutes_evaluated ?? 0) / 60)
  const mins = (summary?.tasks.total_minutes_evaluated ?? 0) % 60

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={ClipboardList} label="Total de Tarefas" value={summary?.tasks.total ?? 0}
          sub="últimos 30 dias" color="bg-primary-700" />
        <KpiCard icon={CheckCircle} label="Avaliações Concluídas" value={summary?.evaluations.completed ?? 0}
          sub="no período" color="bg-emerald-600" />
        <KpiCard icon={Clock} label="Pendentes" value={summary?.tasks.pending ?? 0}
          sub={`${summary?.tasks.in_progress ?? 0} em andamento`} color="bg-amber-500" />
        <KpiCard icon={AlertTriangle} label="Atrasadas" value={summary?.tasks.overdue ?? 0}
          sub="prazo vencido" color="bg-red-600" />
        <KpiCard icon={Timer} label="Minutagem Avaliada" value={`${hours}h ${mins}m`}
          sub="total do período" color="bg-indigo-600" />
        <KpiCard icon={TrendingUp} label="Transf. Indevida" value={summary?.evaluations.transfer_undue ?? 0}
          sub={`${summary?.evaluations.transfer_due ?? 0} devidas`} color="bg-orange-500" />
        <KpiCard icon={Activity} label="NPS — Detratores" value={summary?.evaluations.nps_detractor ?? 0}
          sub={`${summary?.evaluations.nps_promoter ?? 0} promotores`} color="bg-purple-600" />
        <KpiCard icon={Users} label="Monitores Ativos" value={summary?.monitors.active ?? 0}
          sub="com tarefas abertas" color="bg-teal-600" />
      </div>

      {/* Gráfico de barras — Volume diário */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Volume de Tarefas e Avaliações (30 dias)</h3>
        {daily.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={daily} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number, name: string) => [v, name === 'tasks_created' ? 'Tarefas' : 'Avaliações']}
                labelFormatter={l => `Data: ${l}`}
              />
              <Legend formatter={v => v === 'tasks_created' ? 'Tarefas criadas' : 'Avaliações concluídas'} />
              <Bar dataKey="tasks_created" fill="#3949ab" radius={[3,3,0,0]} />
              <Bar dataKey="evaluations_done" fill="#10b981" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
            Nenhum dado no período
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transferência */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Indicador — Transferência</h3>
          {transferData.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={transferData} cx="50%" cy="50%" outerRadius={65}
                  dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}>
                  <Cell fill="#3949ab" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-400 text-sm">Sem avaliações de transferência</div>
          )}
        </div>

        {/* NPS */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Indicador — NPS</h3>
          {npsData.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={npsData} cx="50%" cy="50%" outerRadius={65}
                  dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}>
                  {npsData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-400 text-sm">Sem avaliações de NPS</div>
          )}
        </div>
      </div>

      {/* Ranking de monitores */}
      {monitors.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Produtividade dos Monitores</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">#</th>
                  <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Monitor</th>
                  <th className="text-right py-2 px-3 text-xs text-gray-500 font-medium">Atribuídas</th>
                  <th className="text-right py-2 px-3 text-xs text-gray-500 font-medium">Concluídas</th>
                  <th className="text-right py-2 px-3 text-xs text-gray-500 font-medium">Taxa</th>
                  <th className="text-right py-2 px-3 text-xs text-gray-500 font-medium">Minutos</th>
                </tr>
              </thead>
              <tbody>
                {monitors.map((m, i) => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-3 text-gray-400 font-medium">{i + 1}</td>
                    <td className="py-2.5 px-3 font-medium text-gray-800">{m.name}</td>
                    <td className="py-2.5 px-3 text-right text-gray-600">{m.tasks_assigned}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 font-medium">{m.evaluations_done}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`font-medium ${(m.completion_rate ?? 0) >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {m.completion_rate ?? 0}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-500">{m.minutes_evaluated ?? 0}min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
