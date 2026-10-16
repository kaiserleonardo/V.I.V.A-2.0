from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import re
import json
import asyncio
import logging
from urllib.parse import quote
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import bcrypt
import jwt

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

POLLEN_KEY = os.environ['POLLEN_API_KEY']
POLLEN_BASE = "https://gen.pollinations.ai"
TEXT_MODELS = ["openai-large", "openai", "openai-fast"]
IMAGE_MODELS = {
    "gptimage": "gptimage",
    "flux": "flux",
    "flux-realism": "black-forest-labs/flux.1.1-pro",
    "bytedance/seedream-5.0-pro": "bytedance/seedream-5.0-pro",
    "turbo": "z-image-turbo",
}
JWT_ALGORITHM = "HS256"

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks


# ===== Autenticação (email + senha, JWT) =====

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)

def public_user(doc) -> dict:
    return {"id": str(doc["_id"]), "name": doc.get("name", ""), "email": doc.get("email", ""), "avatar": doc.get("avatar", "🌱")}

async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else request.cookies.get("access_token")
    if not token:
        raise HTTPException(401, "Não autenticado")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(401, "Token inválido")
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sessão expirada. Entre novamente.")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token inválido")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(401, "Usuário não encontrado")
    return user

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=6, max_length=128)

class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=1, max_length=128)

@api_router.post("/auth/register")
async def register(req: RegisterRequest):
    email = req.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "E-mail inválido. Confira e tente de novo.")
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Este e-mail já tem uma conta. Tente entrar.")
    doc = {
        "name": req.name.strip(),
        "email": email,
        "password_hash": hash_password(req.password),
        "avatar": "🌱",
        "role": "user",
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"token": create_access_token(str(result.inserted_id), email), "user": public_user(doc)}

@api_router.post("/auth/login")
async def login(req: LoginRequest, request: Request):
    email = req.email.strip().lower()
    identifier = f"{request.client.host}:{email}"
    attempts = await db.login_attempts.find_one({"identifier": identifier})
    if attempts and attempts.get("count", 0) >= 5:
        last = attempts.get("last")
        if last and datetime.now(timezone.utc) - last.replace(tzinfo=timezone.utc) < timedelta(minutes=15):
            raise HTTPException(429, "Muitas tentativas. Aguarde alguns minutos e tente de novo.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"last": datetime.now(timezone.utc)}},
            upsert=True,
        )
        raise HTTPException(401, "E-mail ou senha incorretos.")
    await db.login_attempts.delete_one({"identifier": identifier})
    return {"token": create_access_token(str(user["_id"]), email), "user": public_user(user)}

@api_router.get("/auth/me")
async def auth_me(request: Request):
    user = await get_current_user(request)
    return {"user": public_user(user)}


# ===== Dados do usuário (matérias, anotações, histórico) =====

class UserData(BaseModel):
    subjects: list = []
    notes: list = []
    history: list = []

@api_router.get("/data")
async def get_data(request: Request):
    user = await get_current_user(request)
    doc = await db.user_data.find_one({"user_id": str(user["_id"])}, {"_id": 0})
    if not doc:
        return {"subjects": [], "notes": [], "history": []}
    return {"subjects": doc.get("subjects", []), "notes": doc.get("notes", []), "history": doc.get("history", [])}

@api_router.put("/data")
async def put_data(req: UserData, request: Request):
    user = await get_current_user(request)
    await db.user_data.update_one(
        {"user_id": str(user["_id"])},
        {"$set": {
            "subjects": req.subjects[:200],
            "notes": req.notes[:500],
            "history": req.history[:100],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"ok": True}


# ===== Integração Pollinations (mesma IA do site original) =====

async def pollinations_chat(messages):
    async with httpx.AsyncClient(timeout=httpx.Timeout(90, connect=10)) as http:
        for model in TEXT_MODELS:
            for attempt in range(2):
                try:
                    r = await http.post(
                        f"{POLLEN_BASE}/v1/chat/completions",
                        headers={"Authorization": f"Bearer {POLLEN_KEY}", "Content-Type": "application/json"},
                        json={"messages": messages, "model": model},
                    )
                    if r.status_code == 200:
                        content = (r.json().get("choices") or [{}])[0].get("message", {}).get("content")
                        if content:
                            return content
                        break
                    if r.status_code in (401, 402, 403):
                        raise HTTPException(502, "Chave da IA recusada ou sem saldo")
                    if r.status_code == 429 or r.status_code >= 500:
                        await asyncio.sleep(0.8 * (attempt + 1))
                        continue
                    break
                except httpx.RequestError:
                    await asyncio.sleep(0.5)
    raise HTTPException(502, "Não foi possível conectar aos serviços de IA")


def clean_html(text):
    return re.sub(r"```html|```", "", text or "", flags=re.I).strip()


class ExplainRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=500)
    subject: str = Field(default="Geral", max_length=120)

@api_router.post("/ai/explain")
async def ai_explain(req: ExplainRequest):
    prompt = f'''És o assistente pedagógico V.I.V.A., especialista em educação neuroinclusiva (Autismo, TDAH, Dislexia, Deficiência Auditiva).
O utilizador deseja aprender sobre o tema "{req.topic}" na disciplina de "{req.subject}".

INSTRUÇÕES DE FORMATO:
- Responde em Português.
- Usa formatação HTML simples (<p>, <ul>, <li>, <strong>). NÃO uses blocos de código nem marcadores ```html.
- Mantém o texto claro, motivador, conciso e dividido nestes 3 pontos:
  1. <strong>O que é:</strong> Definição simples e acolhedora em poucas frases.
  2. <strong>Como funciona / Exemplo:</strong> Explicação prática passo a passo.
  3. <strong>Ponto-chave para memorizar:</strong> Uma dica rápida de fixação.'''
    content = await pollinations_chat([
        {"role": "system", "content": "És um assistente pedagógico amigável e especialista em ensino neuroinclusivo. Responde estritamente em HTML limpo."},
        {"role": "user", "content": prompt},
    ])
    return {"html": clean_html(content)}


class SolveRequest(BaseModel):
    exercise: str = Field(min_length=1, max_length=2000)
    subject: str = Field(default="Geral", max_length=120)

@api_router.post("/ai/solve")
async def ai_solve(req: SolveRequest):
    prompt = f'''És o assistente pedagógico V.I.V.A., especializado em resolver exercícios e deveres escolares com linguagem clara, direta e acessível para todos os alunos.
Resolve o seguinte exercício da disciplina de "{req.subject}":
"{req.exercise}"

INSTRUÇÕES DE FORMATO:
- Responde em Português.
- Usa formatação HTML simples (<p>, <ol>, <li>, <strong>). NÃO uses blocos de código nem marcadores ```html.
- Estrutura a resposta nestes pontos claros:
  1. <strong>Objetivo da Questão:</strong> Explicação direta do que o exercício pede.
  2. <strong>Resolução Passo a Passo:</strong> Lista numerada com passos curtos e fáceis de acompanhar.
  3. <strong>Resposta Final:</strong> O resultado definitivo em destaque.
  4. <strong>Dica de Verificação:</strong> Como confirmar se a resposta está correta.'''
    content = await pollinations_chat([
        {"role": "system", "content": "És um assistente pedagógico focado em resoluções acessíveis e inclusivas. Responde estritamente em HTML limpo."},
        {"role": "user", "content": prompt},
    ])
    return {"html": clean_html(content)}


def question_valid(q):
    return (
        isinstance(q, dict)
        and isinstance(q.get("pergunta"), str)
        and isinstance(q.get("opcoes"), list)
        and len(q["opcoes"]) >= 2
        and isinstance(q.get("respostaCorreta"), int)
        and 0 <= q["respostaCorreta"] < len(q["opcoes"])
    )


def extract_questions(raw):
    text = re.sub(r"```json|```", "", raw or "", flags=re.I).strip()
    i, f = text.find("["), text.rfind("]")
    if i != -1 and f > i:
        try:
            arr = json.loads(text[i:f + 1])
            if isinstance(arr, list):
                ok = [q for q in arr if question_valid(q)]
                if ok:
                    return ok
        except Exception:
            pass
    rescued = []
    stack = []
    in_str = False
    esc = False
    for k, ch in enumerate(text):
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            stack.append(k)
        elif ch == "}" and stack:
            start = stack.pop()
            try:
                obj = json.loads(text[start:k + 1])
                if question_valid(obj):
                    rescued.append(obj)
            except Exception:
                pass
    return rescued


QUIZ_FOCOS = ["conceitos básicos", "exemplos práticos do dia a dia", "detalhes importantes", "aplicação e raciocínio"]

class QuizRequest(BaseModel):
    subject: str = Field(min_length=1, max_length=120)
    topic: str = Field(default="", max_length=300)
    count: int = Field(default=5, ge=1, le=15)

@api_router.post("/ai/quiz")
async def ai_quiz(req: QuizRequest):
    assunto = f'{req.subject}, especificamente sobre "{req.topic.strip()}"' if req.topic.strip() else req.subject
    batches = []
    restante = req.count
    while restante > 0:
        batches.append(min(5, restante))
        restante -= 5

    async def lote(n, i):
        variacao = ""
        if len(batches) > 1:
            variacao = f"\nEste é o lote {i + 1} de {len(batches)}: dá ênfase a {QUIZ_FOCOS[i % len(QUIZ_FOCOS)]} para que as perguntas não se repitam entre lotes."
        prompt = f'''Cria {n} perguntas de escolha múltipla sobre {assunto}, adequadas a um estudante com necessidades neuroinclusivas (Autismo, TDAH, Dislexia): linguagem simples, direta e sem ambiguidade.{variacao}

Responde APENAS com um array JSON válido, sem texto antes ou depois e sem blocos de código, neste formato:
[
  {{
    "pergunta": "texto da pergunta",
    "opcoes": ["opção A", "opção B", "opção C", "opção D"],
    "respostaCorreta": 0,
    "explicacao": "breve explicação de por que esta é a resposta certa"
  }}
]
"respostaCorreta" é o índice (0 a 3) da opção certa dentro de "opcoes". Gera exatamente {n} perguntas, cada uma com exatamente 4 opções.'''
        bruto = await pollinations_chat([
            {"role": "system", "content": "Geras questionários educativos em JSON estrito. Nunca incluis texto fora do array JSON."},
            {"role": "user", "content": prompt},
        ])
        return extract_questions(bruto)

    results = await asyncio.gather(*(lote(n, i) for i, n in enumerate(batches)), return_exceptions=True)
    perguntas = []
    for r in results:
        if isinstance(r, list):
            perguntas.extend(r)
    vistas = set()
    unicas = []
    for q in perguntas:
        chave = q["pergunta"].strip().lower()
        if chave in vistas:
            continue
        vistas.add(chave)
        unicas.append(q)
    unicas = unicas[:req.count]
    if not unicas:
        raise HTTPException(502, "A IA não devolveu perguntas válidas. Tente novamente.")
    return {"questions": unicas}


@api_router.get("/ai/image")
async def ai_image(topic: str, subject: str = "Geral", model: str = "gptimage", seed: int = 0, fallback: int = 0):
    if model not in IMAGE_MODELS:
        model = "gptimage"
    if fallback:
        prompt = f"{topic} educational visual graphic"
        params = {"width": 512, "height": 512, "nologo": "true"}
    else:
        prompt = f"{topic} ({subject}), educational illustration, clean minimalist vector diagram, high detail, vibrant friendly colors, flat visual style, HD quality, no text noise"
        params = {"width": 768, "height": 768, "nologo": "true", "model": IMAGE_MODELS[model]}
    if seed:
        params["seed"] = seed
    url = f"{POLLEN_BASE}/image/{quote(prompt, safe='')}"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(180, connect=10), follow_redirects=True) as http:
            r = await http.get(url, headers={"Authorization": f"Bearer {POLLEN_KEY}"}, params=params)
    except httpx.RequestError:
        raise HTTPException(502, "Não foi possível gerar a ilustração")
    if r.status_code != 200:
        raise HTTPException(502, "Não foi possível gerar a ilustração")
    return StreamingResponse(iter([r.content]), media_type=r.headers.get("content-type", "image/jpeg"))


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL")
    admin_password = os.environ.get("ADMIN_PASSWORD")
    if not admin_email or not admin_password:
        return
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "name": "Administrador",
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "avatar": "✦",
            "role": "admin",
            "created_at": datetime.now(timezone.utc),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})


@app.on_event("startup")
async def startup_db():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await seed_admin()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
