// ============================================================
// Tipos compartilhados entre frontend e backend
// ============================================================

export type UserRole = 'admin' | 'monitor' | 'coordinator'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  is_active: number
  created_at: string
}

export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'done' | 'canceled'
export type TaskIndicator = 'transfer' | 'nps'
export type TaskCallType = 'phone' | 'chat'
export type TaskPriority = 1 | 2 | 3

export interface Task {
  id: string
  import_id: string | null
  call_id: string
  operator_id: string | null
  operator_name?: string
  indicator: TaskIndicator
  call_type: TaskCallType
  duration_sec: number | null
  call_date: string | null
  assigned_to: string | null
  assigned_name?: string
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  cancel_reason: string | null
  extra_data: string | null
  created_at: string
  updated_at: string
}

export type EvaluationStatus = 'draft' | 'completed'
export type TransferResult = 'due' | 'undue'
export type NPSResult = 'promoter' | 'neutral' | 'detractor'
export type NPSModel = 'P2' | 'P3'

export interface Evaluation {
  id: string
  task_id: string
  evaluator_id: string
  evaluator_name?: string
  indicator: TaskIndicator
  nps_model: NPSModel | null
  result: TransferResult | NPSResult | null
  score: number | null
  notes: string | null
  status: EvaluationStatus
  evaluated_at: string | null
  created_at: string
  items?: EvaluationItem[]
}

export interface EvaluationItem {
  id: string
  evaluation_id: string
  criterion_id: string
  criterion_name: string
  answer: string | null
  weight: number
  points: number
}

export interface Criterion {
  id: string
  indicator: TaskIndicator
  model: NPSModel | null
  name: string
  description: string | null
  weight: number
  is_active: number
  sort_order: number
}

export interface Import {
  id: string
  filename: string
  imported_by: string
  imported_by_name?: string
  total_rows: number
  tasks_created: number
  errors: number
  status: 'processing' | 'done' | 'error'
  created_at: string
}

export interface Operator {
  id: string
  external_id: string | null
  name: string
  team: string | null
  is_active: number
}

// Dashboard
export interface DashboardSummary {
  period: { from: string; to: string }
  tasks: {
    total: number
    pending: number
    in_progress: number
    done: number
    canceled: number
    overdue: number
    total_minutes_evaluated: number
  }
  evaluations: {
    total: number
    completed: number
    transfer_due: number
    transfer_undue: number
    nps_promoter: number
    nps_neutral: number
    nps_detractor: number
    avg_nps_score: number | null
  }
  monitors: { active: number }
}

export interface DailyStats {
  date: string
  tasks_created: number
  evaluations_done: number
  minutes_evaluated: number
}

export interface MonitorStats {
  id: string
  name: string
  tasks_assigned: number
  evaluations_done: number
  pending: number
  minutes_evaluated: number
  completion_rate: number
}
