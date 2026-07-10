import { useNavigate, useLocation } from 'react-router-dom'
import { LogOut, Bell } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/tasks':     'Tarefas',
  '/imports':   'Importação de Planilha',
  '/reports':   'Relatórios',
  '/users':     'Gestão de Usuários',
}

export default function Header() {
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const title = titles[location.pathname] ?? 'Quality Platform'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0">
      <h1 className="text-base font-semibold text-gray-800">{title}</h1>

      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500 hidden sm:block">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
        <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors relative">
          <Bell className="w-4 h-4" />
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-red-600 transition-colors p-2 rounded-lg hover:bg-red-50"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:block">Sair</span>
        </button>
      </div>
    </header>
  )
}
