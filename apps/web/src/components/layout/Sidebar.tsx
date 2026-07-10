import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ClipboardList, Upload,
  Users, BarChart3, Shield, ListOrdered
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import clsx from 'clsx'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',  roles: ['admin', 'monitor', 'coordinator'] },
  { to: '/tasks',     icon: ClipboardList,   label: 'Tarefas',    roles: ['admin', 'monitor', 'coordinator'] },
  { to: '/queue',     icon: ListOrdered,     label: 'Fila',       roles: ['admin', 'monitor', 'coordinator'] },
  { to: '/imports',   icon: Upload,          label: 'Importação', roles: ['admin'] },
  { to: '/reports',   icon: BarChart3,       label: 'Relatórios', roles: ['admin', 'coordinator'] },
  { to: '/users',     icon: Users,           label: 'Usuários',   roles: ['admin'] },
]

export default function Sidebar() {
  const { user } = useAuthStore()

  const visible = navItems.filter(item =>
    user?.role && item.roles.includes(user.role)
  )

  return (
    <aside className="w-60 bg-primary-900 flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-primary-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-800" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Quality</p>
            <p className="text-primary-300 text-xs leading-tight">Accenture · Cielo</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visible.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150',
              isActive
                ? 'bg-primary-700 text-white'
                : 'text-primary-200 hover:bg-primary-800 hover:text-white'
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User info */}
      <div className="px-4 py-4 border-t border-primary-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-bold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-medium truncate">{user?.name}</p>
            <p c