-- ============================================================
-- Migration 002: Colunas Cielo (planilha de Transferências)
-- Accenture · Operação Cielo
-- ============================================================

-- Adiciona colunas mapeadas da planilha Cielo
ALTER TABLE tasks ADD COLUMN origin_queue      TEXT;
ALTER TABLE tasks ADD COLUMN destination_queue TEXT;
ALTER TABLE tasks ADD COLUMN g_id_unico        TEXT;

-- Índice para filtrar por fila de origem (tipo de canal)
CREATE INDEX IF NOT EXISTS idx_tasks_origin_queue ON tasks(origin_queue);
CREATE INDEX IF NOT EXISTS idx_tasks_dest_queue   ON tasks(destination_queue);

-- Índice único em call_id para evitar duplicatas na re-importação
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_call_id ON tasks(call_id);
