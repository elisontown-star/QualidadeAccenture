# Setup — Plataforma de Gestão de Qualidade

## Pré-requisitos

- Node.js 20+
- Conta Cloudflare (com Workers e D1 habilitados)
- Wrangler CLI: `npm install -g wrangler`
- Conta Resend (para e-mails)

---

## 1. Clonar e instalar dependências

```bash
git clone https://github.com/sua-org/quality-platform.git
cd quality-platform

# API
cd apps/api && npm install

# Web
cd ../web && npm install
```

---

## 2. Criar banco de dados D1

```bash
# Criar banco local (dev)
wrangler d1 create quality-platform-db

# Copiar o database_id gerado para apps/api/wrangler.toml
# Executar migration
cd apps/api
npm run db:migrate

# Criar usuário admin inicial
npm run db:seed
```

> ⚠️ Após o seed, acesse a plataforma com `admin@qualidade.accenture.com`
> e redefina a senha imediatamente.

---

## 3. Configurar secrets

```bash
cd apps/api

# Chave JWT — gere uma string aleatória longa
wrangler secret put JWT_SECRET

# API Key do Resend
wrangler secret put RESEND_API_KEY
```

---

## 4. Rodar em desenvolvimento

```bash
# Terminal 1 — API
cd apps/api && npm run dev
# Disponível em http://localhost:8787

# Terminal 2 — Web
cd apps/web && npm run dev
# Disponível em http://localhost:5173
```

---

## 5. Deploy em produção

```bash
# Configurar GitHub Secrets:
# CLOUDFLARE_API_TOKEN
# CLOUDFLARE_ACCOUNT_ID
# VITE_API_URL (URL do Worker em produção)

# O deploy é automático via GitHub Actions ao fazer push na branch main
```

---

## Variáveis de ambiente (Web)

Criar `apps/web/.env.local`:

```env
VITE_API_URL=http://localhost:8787
```

Em produção, configurar `VITE_API_URL` como secret no GitHub Actions.

---

## Estrutura de colunas esperada na planilha Cielo

| Coluna         | Obrigatório | Descrição                        |
|----------------|-------------|----------------------------------|
| `ID_CHAMADA`   | ✅          | ID único do atendimento          |
| `OPERADOR`     | ✅          | Nome do operador                 |
| `DURACAO_SEG`  | Não         | Duração em segundos              |
| `INDICADOR`    | Não         | `transfer` ou `nps` (padrão: transfer) |
| `TIPO`         | Não         | `phone` ou `chat` (padrão: phone) |
| `DATA`         | Não         | Data do atendimento (YYYY-MM-DD) |

Colunas adicionais são preservadas em `extra_data` (JSON) para uso futuro.
