import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { reportsApi } from '@/services/api'

export default function ReportsPage() {
  const [productivity, setProductivity] = useState<any[]>([])
  const [indicators, setIndicators] = useState<any[]>([])
  const [operators, setOperators] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dates, setDates] = useState({
    start: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  })

  const load = async () => {
    setLoading(true)
    const params = { start_date: dates.start, end_date: dates.end }
    try {
      const [p, i, o] = await Promise.all([
        reportsApi.productivity(params),
        reportsApi.indicators(params),
        reportsApi.operators(params),
      ])
      setProductivity(p.data.data || [])
      setIndicators(i.data.data || [])
      setOperators(o.data.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Agrupar produtividade por monitor
  const prodByMonitor = productivity.reduce((acc: Record<string, any>, row: any) => {
    if (!acc[row.monitor_name]) acc[row.monitor_name] = { name: row.monitor_name, evaluations: 0, minutes: 0 }
    acc[row.monitor_name].evaluations += row.evaluations
    acc[row.monitor_name].minutes += row.minutes_evaluated || 0
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Filtro de período */}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">De</label>
          <input type="date" value={dates.start}
            onChange={e => setDates(d => ({ ...d, start: e.target.value }))}
            className="input w-auto" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Até</label>
          <input type="date" value={dates.end}
            onChange={e => setDates(d => ({ ...d, end: e.target.value }))}
            className="input w-auto" />
        </div>
        <button onClick={load} className="btn-primary">Filtrar</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700" />
        </div>
      ) : (
        <>
          {/* Produtividade por monitor */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Produtividade por Monitor</h3>
            {Object.keys(prodByMonitor).length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={Object.values(prodByMonitor)} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="evaluations" name="Avaliações" fill="#3949ab" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Sem dados no período</div>
            )}
          </div>

          {/* Indicadores */}
          {indicators.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Indicadores Consolidados</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Indicador', 'Modelo', 'Resultado', 'Quantidade', '%'].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {indicators.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium capitalize">{row.indicator}</td>
                        <td className="py-3 px-4 text-gray-500">{row.nps_model || '—'}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            ['due','promoter'].includes(row.result) ? 'bg-emerald-100 text-emerald-700' :
                            ['undue','detractor'].includes(row.result) ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>{row.result}</span>
                        </td>
                        <td className="py-3 px-4 font-medium">{row.count}</td>
                        <td className="py-3 px-4 text-gray-500">{row.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Desempenho por operador */}
          {operators.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Desempenho por Operador</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Operador', 'Equipe', 'Avaliações', 'Positivo', 'Negativo', 'Taxa Positiva', 'NPS Médio'].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {operators.map(op => (
                      <tr key={op.operator_id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-800">{op.operator_name}</td>
                        <td className="py-3 px-4 text-gray-500">{op.team || '—'}</td>
                        <td className="py-3 px-4">{op.total_evaluations}</td>
                        <td className="py-3 px-4 text-emerald-600 font-medium">{op.positive}</td>
                        <td className="py-3 px-4 text-red-500">{op.negative}</td>
                        <td className="py-3 px-4">
                          <span className={`font-medium ${(op.positive_rate ?? 0) >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {op.positive_rate ?? 0}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{op.avg_nps ? Number(op.avg_nps).toFixed(1) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
