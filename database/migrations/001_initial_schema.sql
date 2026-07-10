-- ============================================================
-- Migration 001: Schema inicial da Plataforma de Qualidade
-- Accenture · Operação Cielo
-- ============================================================

-- Usuários da plataforma
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role         TEXT NOT NULL CHECK(role IN ('admin', 'monitor', 'coordinator')),
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Operadores da Cielo avaliados
CREATE TABLE IF NOT EXISTS operators (
  id          TEXT PRIMARY KEY,
  external_id TEXT,
  name        TEXT NOT NULL,
  team        TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_operators_external ON operators(external_id);

-- Registro de importações de planilhas
CREATE TABLE IF NOT EXISTS imports (
  id            TEXT PRIMARY KEY,
  filename      TEXT NOT NULL,
  imported_by   TEXT NOT NULL REFERENCES users(id),
  total_rows    INTEGER NOT NULL DEFAULT 0,
  tasks_created INTEGER NOT NULL DEFAULT 0,
  errors        INTEGER NOT NULL DEFAULT 0,
  error_log     TEXT, -- JSON com detalhes dos erros
  status        TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','done','error')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tarefas (chamados) geradas a partir das planilhas
CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,
  import_id    TEXT REFERENCES imports(id),
  call_id      TEXT NOT NULL,
  operator_id  TEXT REFERENCES operators(id),
  indicator    TEXT NOT NULL CHECK(indicator IN ('transfer','nps')),
  call_type    TEXT NOT NULL CHECK(call_type IN ('phone','chat')),
  duration_sec INTEGER,
  call_date    TEXT,
  assigned_to  TEXT REFERENCES users(id),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK(status IN ('pending','assigned','in_progress','done','canceled')),
  priority     INTEGER NOT NULL DEFAULT 2 CHECK(priority IN (1,2,3)),
  due_date     TEXT,
  cancel_reason TEXT,
  extra_data   TEXT, -- JSON com campos adicionais da planilha
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_indicator   ON tasks(indicator);
CREATE INDEX IF NOT EXISTS idx_tasks_call_date   ON tasks(call_date);

-- Avaliações dos atendimentos
CREATE TABLE IF NOT EXISTS evaluations (
  id           TEXT PRIMARY KEY,
  task_id      TEXT NOT NULL REFERENCES tasks(id),
  evaluator_id TEXT NOT NULL REFERENCES users(id),
  indicator    TEXT NOT NULL,
  nps_model    TEXT CHECK(nps_model IN ('P2','P3') OR nps_model IS NULL),
  result       TEXT, -- 'due'|'undue' para transfer; 'promoter'|'neutral'|'detractor' para nps
  score        REAL,
  notes        TEXT,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','completed')),
  evaluated_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_evaluations_task ON evaluations(task_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_evaluator   ON evaluations(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_status      ON evaluations(status);

-- Itens/critérios de cada avaliação
CREATE TABLE IF NOT EXISTS evaluation_items (
  id             TEXT PRIMARY KEY,
  evaluation_id  TEXT NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  criterion_id   TEXT NOT NULL,
  criterion_name TEXT NOT NULL,
  answer         TEXT, -- 'yes'|'no'|'na' ou valor livre
  weight         REAL NOT NULL DEFAULT 1.0,
  points         REAL NOT NULL DEFAULT 0.0
);
CREATE INDEX IF NOT EXISTS idx_eval_items_eval ON evaluation_items(evaluation_id);

-- Critérios de avaliação configuráveis por indicador/modelo
CREATE TABLE IF NOT EXISTS criteria (
  id          TEXT PRIMARY KEY,
  indicator   TEXT NOT NULL,
  model       TEXT, -- NULL para transfer; 'P2'|'P3' para nps
  name        TEXT NOT NULL,
  description TEXT,
  weight      REAL NOT NULL DEFAULT 1.0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_criteria_indicator ON criteria(indicator, model);

-- Log de auditoria de ações
CREATE TABLE IF NOT EXISTS audit_logs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL, -- 'task'|'evaluation'|'user'|'import' etc.
  entity_id  TEXT,
  detail     TEXT, -- JSON com contexto adicional
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- Notificações
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  read       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read);
