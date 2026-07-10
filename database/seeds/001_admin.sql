-- Seed: usuário administrador padrão
-- ATENÇÃO: Trocar a senha no primeiro login
-- password: Admin@2026 (hash bcrypt abaixo é apenas placeholder — gerar via código)

INSERT OR IGNORE INTO users (id, name, email, password_hash, role, is_active)
VALUES (
  'usr_admin_001',
  'Administrador',
  'admin@qualidade.accenture.com',
  '$2b$12$PLACEHOLDER_HASH_MUST_BE_GENERATED',
  'admin',
  1
);
