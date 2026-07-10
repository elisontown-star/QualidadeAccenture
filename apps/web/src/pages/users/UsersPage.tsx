import { useEffect, useState } from 'react'
import { UserPlus, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react'
import { usersApi } from '@/services/api'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  monitor: 'Monitor',
  coordinator: 'Coordenador',
}
const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  monitor: 'bg-blue-100 text-blue-700',
  coordinator: 'bg-teal-100 text-teal-700',
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'monitor' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await usersApi.create(form)
      onCreated()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao criar usuário')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Novo Usuário</h3>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input" required placeholder="João Silva" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="input" required placeholder="joao@accenture.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha inicial</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="input" required placeholder="Mínimo 8 caracteres" minLength={8} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Perfil</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="input">
              <option value="monitor">Monitor</option>
              <option value="coordinator">Coordenador</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Criando...' : 'Criar usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [roleFilter, setRoleFilter] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (roleFilter) params.role = roleFilter
      const { data } = await usersApi.list(params)
      setUsers(data.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [roleFilter])

  const toggleUser = async (id: string) => {
    await usersApi.toggle(id)
    load()
  }

  return (
    <div className="space-y-4">
      {showModal && <CreateModal onClose={() => setShowModal(false)} onCreated={load} />}

      {/* Ações */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="input w-auto">
            <option value="">Todos os perfis</option>
            <option value="admin">Administrador</option>
            <option value="monitor">Monitor</option>
            <option value="coordinator">Coordenador</option>
          </select>
          <button onClick={load} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Novo usuário
        </button>
      </div>

      {/* Lista */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-700" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Usuário', 'E-mail', 'Perfil', 'Status', 'Cadastro', 'Ações'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-bold">
                          {user.name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-800">{user.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-500">{user.email}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${ROLE_COLORS[user.role] || ''}`}>
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                        user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {user.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs">
                      {new Date(user.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleUser(user.id)}
                        title={user.is_active ? 'Desativar' : 'Ativar'}
                        className={`transition-colors ${user.is_active ? 'text-emerald-500 hover:text-red-500' : 'text-gray-300 hover:text-emerald-500'}`}
                      >
                        {user.is_active
                          ? <ToggleRight className="w-6 h-6" />
                          : <ToggleLeft className="w-6 h-6" />
                        }
                      </button>
                    </td>
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
