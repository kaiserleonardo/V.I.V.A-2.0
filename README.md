# V.I.V.A — Aprendizagem Visual Interativa

Plataforma escolar neuroinclusiva que transforma matérias em explicações claras, ilustrações didáticas geradas por IA e questionários adaptados — feita para pessoas com transtornos de aprendizagem (Autismo, TDAH, Dislexia).

## Funcionalidades

- Perfis Aluno / Professor
- Explicações geradas por IA com linguagem simples e acolhedora (Pollinations)
- Ilustrações didáticas geradas por IA com modelos escolhíveis (GPT Image, FLUX, SeeDream, SDXL Turbo)
- Questionários gerados por IA (5/10/15 perguntas, com feedback e explicação)
- Soluções passo a passo de exercícios (área do professor)
- Anotações, histórico de estudos e matérias personalizadas
- Contas reais com e-mail e senha (JWT + bcrypt)
- Banco de dados MongoDB por usuário
- Acessibilidade: leitura em voz alta, modo escuro, redução de animações, tamanho de fonte ajustável, foco visível

## Estrutura

```
backend/    FastAPI + MongoDB (motor) + integração Pollinations + auth JWT
frontend/   React (CRA) + CSS próprio
```

## Como rodar localmente

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # preencha com suas chaves
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend
```bash
cd frontend
yarn install
cp .env.example .env   # aponte REACT_APP_BACKEND_URL para o backend
yarn start
```

## Variáveis de ambiente

Veja `backend/.env.example` e `frontend/.env.example`. Nunca suba os arquivos `.env` reais para o GitHub — eles contêm chaves secretas.

## Observação sobre hospedagem

Este é um app full-stack: precisa do backend (FastAPI) rodando para login, banco de dados e IA. GitHub Pages sozinho não é suficiente, pois só serve arquivos estáticos. Hospede o backend em um serviço como Render/Railway e o frontend em Vercel/Netlify, ou use a publicação integrada da Emergent.
