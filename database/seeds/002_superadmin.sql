-- Seed: Super Admin — Valdielison
-- Senha inicial: Vtech@2026
-- Trocar no primeiro acesso

INSERT OR IGNORE INTO users (id, name, email, password_hash, role, is_active)
VALUES (
  'usr_superadmin_001',
  'Valdielison',
  'valdielison@vtechit.com.br',
  'pbkdf2$100000$9f901de4ccd02c21537c09aff26c89a7$748534fd4f398db91e3aaa2bc470ba4ef9ac02e218e06cabd6029fc19610a141',
  'admin',
  1
);
