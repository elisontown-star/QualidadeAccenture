import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Injeta o token automaticamente em todas as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('qp_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redireciona para login se o token expirar
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('qp_token')
      localStorage.removeItem('qp_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  summary: (params?: { start_date?: string; end_date?: string }) =>
    api.get('/dashboard/summary', { params }),
  daily: (days = 30) =>
    api.get('/dashboard/daily', { params: { days } }),
  monitors: (params?: { start_date?: string; end_date?: string }) =>
    api.get('/dashboard/monitors', { params }),
  npsTrend: (weeks = 12) =>
    api.get('/dashboard/nps-trend', { params: { weeks } }),
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
export const tasksApi = {
  list: (params?: Record<string, string>) =>
    api.get('/tasks', { params }),
  get: (id: string) =>
    api.get(`/tasks/${id}`),
  assign: (id: string, monitor_id: string) =>
    api.patch(`/tasks/${id}/assign`, { monitor_id }),
  bulkAssign: (task_ids: string[], monitor_ids: string[], mode = 'balanced') =>
    api.post('/tasks/bulk-assign', { task_ids, monitor_ids, mode }),
  updateStatus: (id: string, status: string) =>
    api.patch(`/tasks/${id}/status`, { status }),
  cancel: (id: string, reason: string) =>
    api.delete(`/tasks/${id}`, { data: { reason } }),
}

// ── Imports ───────────────────────────────────────────────────────────────────
export const importsApi = {
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/imports', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  list: () => api.get('/imports'),
  get: (id: string) => api.get(`/imports/${id}`),
}

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  list: (params?: Record<string, string>) =>
    api.get('/users', { params }),
  create: (data: { name: string; email: string; password: string; role: string }) =>
    api.post('/users', data),
  update: (id: string, data: { name?: string; role?: string }) =>
    api.put(`/users/${id}`, data),
  toggle: (id: string) =>
    api.patch(`/users/${id}/toggle`),
}

// ── Evaluations ───────────────────────────────────────────────────────────────
export const evaluationsApi = {
  save: (data: Record<string, unknown>) =>
    api.post('/evaluations', data),
  get: (id: string) =>
    api.get(`/evaluations/${id}`),
  submit: (id: string) =>
    api.post(`/evaluations/${id}/submit`),
}

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsApi = {
  productivity: (params?: Record<string, string>) =>
    api.get('/reports/productivity', { params }),
  indicators: (params?: Record<string, string>) =>
    api.get('/reports/indicators', { params }),
  operators: (params?: Record<string, string>) =>
    api.get('/reports/operators', { params }),
}
