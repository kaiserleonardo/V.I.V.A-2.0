# Auth Testing Playbook — V.I.V.A

## Passo 1: MongoDB
```
mongosh
use test_database
db.users.find({role: "admin"}).pretty()
db.users.findOne({role: "admin"}, {password_hash: 1})
```
Verificar: hash bcrypt começa com `$2b$`; índice único em `users.email`; índice em `login_attempts.identifier`.

## Passo 2: API
```
curl -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@viva.app","password":"VivaAdmin#2026"}'
```
Usar o `token` retornado como Bearer:
```
curl http://localhost:8001/api/auth/me -H "Authorization: Bearer <token>"
curl -X PUT http://localhost:8001/api/data -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"subjects":[],"notes":[],"history":[]}'
curl http://localhost:8001/api/data -H "Authorization: Bearer <token>"
```
Casos negativos: senha errada retorna 401 "E-mail ou senha incorretos."; e-mail duplicado retorna 400; sem token retorna 401; 5 senhas erradas em 15 min retornam 429.

## Passo 3: Frontend (e2e)
1. Abrir modal de conta (ícone no topo ou chip do perfil) → aba "Criar conta" → nome, e-mail, senha → conta criada e chip mostra nome + e-mail.
2. Criar anotação → aguardar ~2s → GET /api/data deve conter a anotação.
3. Sair da conta → entrar de novo → anotações/matérias/histórico restaurados do banco.
