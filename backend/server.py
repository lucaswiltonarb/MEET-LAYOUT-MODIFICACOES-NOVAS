import os
import logging
import hmac
import hashlib
import time
import random
import asyncio
import base64
import jwt as pyjwt
from jwt import PyJWKClient
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from svix.webhooks import Webhook

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ── Config ──────────────────────────────────────────────────────────
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ.get('DB_NAME', 'moogle_meet')
STREAM_API_KEY = os.environ.get('STREAM_VIDEO_API_KEY', '')
STREAM_API_SECRET = os.environ.get('STREAM_VIDEO_API_SECRET', '')
STREAM_CHAT_API_KEY = os.environ.get('STREAM_CHAT_API_KEY', STREAM_API_KEY)
STREAM_CHAT_API_SECRET = os.environ.get('STREAM_CHAT_API_SECRET', STREAM_API_SECRET)
CLERK_SECRET_KEY = os.environ.get('CLERK_SECRET_KEY', '')
WEBHOOK_SECRET = os.environ.get('WEBHOOK_SECRET', '')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')
SESSION_SECRET = os.environ.get('ADMIN_SESSION_SECRET', 'dev_secret_32_chars_xxxxxxxxxxxxx')
CLERK_PK = os.environ.get('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', '')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("moogle-meet")

# ── MongoDB ─────────────────────────────────────────────────────────
mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client[DB_NAME]

# ── Stream Chat SDK (sync) ──────────────────────────────────────────
from stream_chat import StreamChat
stream_chat_client = None
try:
    if STREAM_CHAT_API_KEY and STREAM_CHAT_API_SECRET:
        stream_chat_client = StreamChat(api_key=STREAM_CHAT_API_KEY, api_secret=STREAM_CHAT_API_SECRET)
except Exception as e:
    logger.warning(f"Stream Chat SDK init failed: {e}")

# ── Clerk JWKS ──────────────────────────────────────────────────────
clerk_jwks_client = None
try:
    if CLERK_PK:
        encoded = CLERK_PK.replace('pk_test_', '').replace('pk_live_', '')
        padding = 4 - len(encoded) % 4
        if padding != 4:
            encoded += '=' * padding
        instance = base64.b64decode(encoded).decode().rstrip('$')
        jwks_url = f"https://{instance}/.well-known/jwks.json"
        clerk_jwks_client = PyJWKClient(jwks_url)
        logger.info(f"Clerk JWKS URL: {jwks_url}")
except Exception as e:
    logger.warning(f"Clerk JWKS init failed: {e}")

# ── FastAPI App ─────────────────────────────────────────────────────
app = FastAPI(title="Moogle Meet API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Helpers ─────────────────────────────────────────────────────────
def str_id(doc):
    if doc and '_id' in doc:
        doc['_id'] = str(doc['_id'])
    return doc

def create_stream_token(api_secret, user_id):
    return pyjwt.encode({"user_id": user_id}, api_secret, algorithm="HS256")

def sign_session(data):
    return hmac.new(SESSION_SECRET.encode(), data.encode(), hashlib.sha256).hexdigest()

def build_session_token():
    exp = int(time.time()) + 43200
    payload = f"admin|{exp}"
    sig = sign_session(payload)
    return f"{payload}|{sig}"

def verify_session_token(token):
    if not token:
        return False
    parts = token.split('|')
    if len(parts) != 3:
        return False
    role, exp_str, sig = parts
    try:
        exp = int(exp_str)
    except ValueError:
        return False
    if exp < int(time.time()):
        return False
    expected = sign_session(f"{role}|{exp_str}")
    return expected == sig and role == 'admin'

async def get_clerk_user_id(request: Request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:]
    if not token or not clerk_jwks_client:
        return None
    try:
        signing_key = clerk_jwks_client.get_signing_key_from_jwt(token)
        decoded = pyjwt.decode(token, signing_key.key, algorithms=["RS256"], options={"verify_aud": False})
        return decoded.get("sub")
    except Exception as e:
        logger.warning(f"Clerk token verification failed: {e}")
        return None

async def require_admin(request: Request):
    token = request.cookies.get("admin_session", "")
    if not verify_session_token(token):
        return None
    return True

async def require_expert(request: Request):
    user_id = await get_clerk_user_id(request)
    if not user_id:
        return None, None, None
    expert = await db.experts.find_one({"clerkUserId": user_id, "active": True})
    if not expert:
        return user_id, None, None
    plan = None
    if expert.get("planId"):
        try:
            plan = await db.plans.find_one({"_id": ObjectId(str(expert["planId"]))})
        except Exception:
            pass
    return user_id, expert, plan

def stream_sync_upsert_user(user_data):
    if stream_chat_client:
        try:
            stream_chat_client.upsert_user(user_data)
        except Exception as e:
            logger.warning(f"Stream upsert_user failed: {e}")

def stream_sync_upsert_users(users_data):
    if stream_chat_client:
        try:
            stream_chat_client.upsert_users(users_data)
        except Exception as e:
            logger.warning(f"Stream upsert_users failed: {e}")

def stream_sync_channel_create_and_add(channel_type, channel_id, user_id, members=None):
    if not stream_chat_client:
        return
    try:
        channel = stream_chat_client.channel(channel_type, channel_id)
        try:
            channel.create(user_id)
        except Exception:
            pass
        if members:
            try:
                channel.add_members(members)
            except Exception:
                pass
    except Exception as e:
        logger.warning(f"Stream channel op failed: {e}")

def stream_sync_send_message(channel_type, channel_id, user_id, text):
    if not stream_chat_client:
        return None
    try:
        channel = stream_chat_client.channel(channel_type, channel_id)
        result = channel.send_message({"text": text}, user_id)
        return result
    except Exception as e:
        logger.warning(f"Stream send_message failed: {e}")
        return None

# ── DB Init ─────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    try:
        await db.experts.create_index("clerkUserId", unique=True, sparse=True)
        await db.experts.create_index("email", unique=True)
        await db.plans.create_index("name", unique=True)
        await db.fake_profiles.create_index("expertId")
        await db.scheduled_comments.create_index("meetingId")
    except Exception:
        pass
    count = await db.plans.count_documents({})
    if count == 0:
        await db.plans.insert_many([
            {"name": "Free", "maxFakeParticipants": 5, "maxComments": 10, "price": 0, "active": True, "createdAt": datetime.now(timezone.utc)},
            {"name": "Pro", "maxFakeParticipants": 30, "maxComments": 100, "price": 49, "active": True, "createdAt": datetime.now(timezone.utc)},
            {"name": "Premium", "maxFakeParticipants": 100, "maxComments": 500, "price": 199, "active": True, "createdAt": datetime.now(timezone.utc)},
        ])

@app.on_event("shutdown")
async def shutdown():
    mongo_client.close()

# ── Health ──────────────────────────────────────────────────────────
@app.get("/health")
async def health_root():
    return {"status": "ok"}

@app.get("/api/health")
async def health():
    return {"status": "ok"}

# ── Token ───────────────────────────────────────────────────────────
@app.post("/api/token")
async def create_token(request: Request):
    body = await request.json()
    user_id = body.get("userId")
    if not user_id:
        return Response(content='{"error":"userId is required"}', status_code=400, media_type="application/json")
    video_token = create_stream_token(STREAM_API_SECRET, user_id)
    chat_token = create_stream_token(STREAM_CHAT_API_SECRET, user_id)
    return {"userId": user_id, "token": video_token, "videoToken": video_token, "chatToken": chat_token}

# ── User Update ─────────────────────────────────────────────────────
@app.post("/api/user")
async def update_user(request: Request):
    body = await request.json()
    user = body.get("user")
    if not user:
        return Response(content='{"error":"user is required"}', status_code=400, media_type="application/json")
    user_data = {"id": user["id"], "name": user.get("name", ""), "role": "user"}
    await asyncio.to_thread(stream_sync_upsert_user, user_data)
    return {"ok": True}

# ── Webhooks (Clerk) ────────────────────────────────────────────────
@app.post("/api/webhooks")
async def clerk_webhook(request: Request):
    if not WEBHOOK_SECRET:
        return Response(content="WEBHOOK_SECRET not set", status_code=500)
    body_bytes = await request.body()
    headers_dict = {
        "svix-id": request.headers.get("svix-id", ""),
        "svix-timestamp": request.headers.get("svix-timestamp", ""),
        "svix-signature": request.headers.get("svix-signature", ""),
    }
    if not all(headers_dict.values()):
        return Response(content="Missing svix headers", status_code=400)
    try:
        wh = Webhook(WEBHOOK_SECRET)
        evt = wh.verify(body_bytes.decode(), headers_dict)
    except Exception as e:
        logger.error(f"Webhook verification failed: {e}")
        return Response(content="Verification failed", status_code=400)
    event_type = evt.get("type", "")
    if event_type in ("user.created", "user.updated"):
        data = evt.get("data", {})
        user_payload = {
            "id": data.get("id"),
            "role": "user",
            "name": f"{data.get('first_name', '')} {data.get('last_name', '')}".strip() or data.get("username", "User"),
            "image": data.get("image_url") if data.get("has_image") else None,
        }
        await asyncio.to_thread(stream_sync_upsert_user, user_payload)
    return {"ok": True}

# ── Meeting Fakes (public) ──────────────────────────────────────────
@app.get("/api/meeting-fakes")
async def get_meeting_fakes(meetingId: str = ""):
    if not meetingId:
        return {"fakes": []}
    fakes = await db.fake_profiles.find({"meetingId": meetingId, "active": True}).to_list(1000)
    return {"fakes": [{"_id": str(f["_id"]), "streamId": f"fake_{str(f['_id'])}", "name": f["name"], "avatarColor": f.get("avatarColor", "#1a73e8"), "imageUrl": f.get("imageUrl")} for f in fakes]}

# ── Channel Join ────────────────────────────────────────────────────
@app.post("/api/channel-join")
async def channel_join(request: Request):
    body = await request.json()
    meeting_id = body.get("meetingId")
    user_id = body.get("userId")
    user_name = body.get("userName", user_id)
    if not meeting_id or not user_id:
        return Response(content='{"error":"meetingId and userId required"}', status_code=400, media_type="application/json")
    role = "guest" if user_id.startswith("guest_") else "user"
    await asyncio.to_thread(stream_sync_upsert_user, {"id": user_id, "role": role, "name": user_name or user_id})
    await asyncio.to_thread(stream_sync_channel_create_and_add, "messaging", meeting_id, user_id, [user_id])
    return {"ok": True, "meetingId": meeting_id, "userId": user_id}

# ── Admin Auth ──────────────────────────────────────────────────────
@app.post("/api/admin/login")
async def admin_login(request: Request):
    body = await request.json()
    if body.get("password") != ADMIN_PASSWORD:
        return Response(content='{"error":"Invalid password"}', status_code=401, media_type="application/json")
    token = build_session_token()
    response = Response(content='{"ok":true}', media_type="application/json")
    response.set_cookie("admin_session", token, httponly=True, secure=True, samesite="lax", path="/", max_age=43200)
    return response

@app.post("/api/admin/logout")
async def admin_logout():
    response = Response(content='{"ok":true}', media_type="application/json")
    response.delete_cookie("admin_session", path="/")
    return response

@app.get("/api/admin/me")
async def admin_me(request: Request):
    ok = await require_admin(request)
    return {"authenticated": bool(ok)}

# ── Admin Stats ─────────────────────────────────────────────────────
@app.get("/api/admin/stats")
async def admin_stats(request: Request):
    if not await require_admin(request):
        return Response(content='{"error":"unauthorized"}', status_code=401, media_type="application/json")
    plans = await db.plans.count_documents({})
    experts = await db.experts.count_documents({})
    fakes = await db.fake_profiles.count_documents({})
    comments = await db.scheduled_comments.count_documents({})
    return {"plans": plans, "experts": experts, "fakes": fakes, "comments": comments}

# ── Admin Plans ─────────────────────────────────────────────────────
@app.get("/api/admin/plans")
async def get_plans(request: Request):
    if not await require_admin(request):
        return Response(content='{"error":"unauthorized"}', status_code=401, media_type="application/json")
    plans = await db.plans.find({}).sort("price", 1).to_list(1000)
    return {"plans": [{**p, "_id": str(p["_id"])} for p in plans]}

@app.post("/api/admin/plans")
async def create_plan(request: Request):
    if not await require_admin(request):
        return Response(content='{"error":"unauthorized"}', status_code=401, media_type="application/json")
    body = await request.json()
    name = str(body.get("name", "")).strip()
    if not name:
        return Response(content='{"error":"name required"}', status_code=400, media_type="application/json")
    doc = {"name": name, "maxFakeParticipants": int(body.get("maxFakeParticipants", 0)), "maxComments": int(body.get("maxComments", 0)), "price": float(body.get("price", 0)), "active": body.get("active", True), "createdAt": datetime.now(timezone.utc)}
    result = await db.plans.insert_one(doc)
    return {"ok": True, "id": str(result.inserted_id)}

@app.put("/api/admin/plans")
async def update_plan(request: Request):
    if not await require_admin(request):
        return Response(content='{"error":"unauthorized"}', status_code=401, media_type="application/json")
    body = await request.json()
    pid = body.get("_id")
    if not pid:
        return Response(content='{"error":"id required"}', status_code=400, media_type="application/json")
    update = {}
    for k in ["name", "maxFakeParticipants", "maxComments", "price", "active"]:
        if k in body:
            update[k] = body[k]
    if "maxFakeParticipants" in update:
        update["maxFakeParticipants"] = int(update["maxFakeParticipants"])
    if "maxComments" in update:
        update["maxComments"] = int(update["maxComments"])
    if "price" in update:
        update["price"] = float(update["price"])
    await db.plans.update_one({"_id": ObjectId(pid)}, {"$set": update})
    return {"ok": True}

@app.delete("/api/admin/plans")
async def delete_plan(request: Request):
    if not await require_admin(request):
        return Response(content='{"error":"unauthorized"}', status_code=401, media_type="application/json")
    pid = request.query_params.get("id")
    if not pid:
        return Response(content='{"error":"id required"}', status_code=400, media_type="application/json")
    await db.plans.delete_one({"_id": ObjectId(pid)})
    return {"ok": True}

# ── Admin Experts ───────────────────────────────────────────────────
@app.get("/api/admin/experts")
async def get_experts(request: Request):
    if not await require_admin(request):
        return Response(content='{"error":"unauthorized"}', status_code=401, media_type="application/json")
    experts = await db.experts.find({}).sort("createdAt", -1).to_list(1000)
    plans = await db.plans.find({}).to_list(1000)
    plans_map = {str(p["_id"]): p for p in plans}
    result = []
    for e in experts:
        e["_id"] = str(e["_id"])
        plan = plans_map.get(str(e.get("planId", "")))
        e["plan"] = {**plan, "_id": str(plan["_id"])} if plan else None
        result.append(e)
    return {"experts": result}

@app.post("/api/admin/experts")
async def create_expert(request: Request):
    if not await require_admin(request):
        return Response(content='{"error":"unauthorized"}', status_code=401, media_type="application/json")
    body = await request.json()
    email = str(body.get("email", "")).strip().lower()
    name = str(body.get("name", "")).strip()
    if not email or not name:
        return Response(content='{"error":"email and name required"}', status_code=400, media_type="application/json")
    doc = {"email": email, "name": name, "active": body.get("active", True), "createdAt": datetime.now(timezone.utc)}
    if body.get("clerkUserId"):
        doc["clerkUserId"] = str(body["clerkUserId"])
    if body.get("planId"):
        doc["planId"] = str(body["planId"])
    try:
        result = await db.experts.insert_one(doc)
        return {"ok": True, "id": str(result.inserted_id)}
    except Exception as e:
        return Response(content=f'{{"error":"{str(e)}"}}', status_code=400, media_type="application/json")

@app.put("/api/admin/experts")
async def update_expert(request: Request):
    if not await require_admin(request):
        return Response(content='{"error":"unauthorized"}', status_code=401, media_type="application/json")
    body = await request.json()
    eid = body.get("_id")
    if not eid:
        return Response(content='{"error":"id required"}', status_code=400, media_type="application/json")
    update = {}
    for k in ["email", "name", "clerkUserId", "planId", "active"]:
        if k in body:
            update[k] = body[k]
    if "email" in update:
        update["email"] = update["email"].lower()
    await db.experts.update_one({"_id": ObjectId(eid)}, {"$set": update})
    return {"ok": True}

@app.delete("/api/admin/experts")
async def delete_expert(request: Request):
    if not await require_admin(request):
        return Response(content='{"error":"unauthorized"}', status_code=401, media_type="application/json")
    eid = request.query_params.get("id")
    if not eid:
        return Response(content='{"error":"id required"}', status_code=400, media_type="application/json")
    await db.experts.delete_one({"_id": ObjectId(eid)})
    return {"ok": True}

# ── Expert Check ────────────────────────────────────────────────────
@app.get("/api/expert/check")
async def expert_check(request: Request):
    user_id, expert, plan = await require_expert(request)
    if not expert:
        return {"isExpert": False}
    return {"isExpert": True, "expert": {**str_id(dict(expert)), "planId": str(expert.get("planId", "")) or None}, "plan": {**str_id(dict(plan))} if plan else None}

# ── Expert Fakes ────────────────────────────────────────────────────
COLORS = ['#1a73e8', '#9334e6', '#ea4335', '#34a853', '#ff6d01', '#46bdc6', '#7cb342', '#ff5722']

@app.get("/api/expert/fakes")
async def get_expert_fakes(request: Request):
    user_id, expert, plan = await require_expert(request)
    if not expert:
        return Response(content='{"error":"not an expert"}', status_code=403, media_type="application/json")
    meeting_id = request.query_params.get("meetingId")
    filt = {"expertId": str(expert["_id"])}
    if meeting_id:
        filt["meetingId"] = meeting_id
    fakes = await db.fake_profiles.find(filt).sort("createdAt", -1).to_list(1000)
    return {"fakes": [{**f, "_id": str(f["_id"])} for f in fakes], "plan": {**str_id(dict(plan))} if plan else None}

@app.post("/api/expert/fakes")
async def create_expert_fake(request: Request):
    user_id, expert, plan = await require_expert(request)
    if not expert:
        return Response(content='{"error":"not an expert"}', status_code=403, media_type="application/json")
    body = await request.json()
    meeting_id = body.get("meetingId")
    name = str(body.get("name", "")).strip()
    if not meeting_id or not name:
        return Response(content='{"error":"meetingId and name required"}', status_code=400, media_type="application/json")
    dupe = await db.fake_profiles.find_one({"expertId": str(expert["_id"]), "meetingId": meeting_id, "name": name})
    if dupe:
        return Response(content=f'{{"error":"Ja existe um fake chamado \\"{name}\\" nesta reuniao."}}', status_code=409, media_type="application/json")
    if plan:
        count = await db.fake_profiles.count_documents({"expertId": str(expert["_id"]), "meetingId": meeting_id})
        if count >= plan.get("maxFakeParticipants", 999):
            return Response(content='{"error":"Plan limit reached"}', status_code=403, media_type="application/json")
    color = random.choice(COLORS)
    doc = {"expertId": str(expert["_id"]), "meetingId": meeting_id, "name": name, "avatarColor": color, "imageUrl": body.get("imageUrl"), "active": True, "createdAt": datetime.now(timezone.utc)}
    result = await db.fake_profiles.insert_one(doc)
    fake_id = f"fake_{str(result.inserted_id)}"
    await asyncio.to_thread(stream_sync_upsert_user, {"id": fake_id, "role": "user", "name": name, "image": body.get("imageUrl")})
    await asyncio.to_thread(stream_sync_channel_create_and_add, "messaging", meeting_id, fake_id, [fake_id])
    return {"ok": True, "fake": {**doc, "_id": str(result.inserted_id), "streamId": fake_id}}

@app.delete("/api/expert/fakes")
async def delete_expert_fakes(request: Request):
    user_id, expert, plan = await require_expert(request)
    if not expert:
        return Response(content='{"error":"not an expert"}', status_code=403, media_type="application/json")
    expert_id = str(expert["_id"])
    all_param = request.query_params.get("all")
    meeting_id = request.query_params.get("meetingId")
    ids_param = request.query_params.get("ids")
    id_param = request.query_params.get("id")
    if all_param == "true":
        if not meeting_id:
            return Response(content='{"error":"meetingId required"}', status_code=400, media_type="application/json")
        docs = await db.fake_profiles.find({"expertId": expert_id, "meetingId": meeting_id}).to_list(10000)
        obj_ids = [d["_id"] for d in docs]
        str_ids = [str(d["_id"]) for d in docs]
        await db.fake_profiles.delete_many({"_id": {"$in": obj_ids}})
        await db.scheduled_comments.delete_many({"fakeProfileId": {"$in": str_ids}})
        return {"ok": True, "deleted": len(str_ids)}
    if ids_param:
        id_list = [s.strip() for s in ids_param.split(",") if s.strip()]
        obj_ids = [ObjectId(i) for i in id_list]
        docs = await db.fake_profiles.find({"_id": {"$in": obj_ids}, "expertId": expert_id}).to_list(10000)
        real_ids = [d["_id"] for d in docs]
        real_str = [str(d["_id"]) for d in docs]
        await db.fake_profiles.delete_many({"_id": {"$in": real_ids}})
        await db.scheduled_comments.delete_many({"fakeProfileId": {"$in": real_str}})
        return {"ok": True, "deleted": len(real_str)}
    if not id_param:
        return Response(content='{"error":"id required"}', status_code=400, media_type="application/json")
    await db.fake_profiles.delete_one({"_id": ObjectId(id_param), "expertId": expert_id})
    await db.scheduled_comments.delete_many({"fakeProfileId": id_param})
    return {"ok": True, "deleted": 1}

# ── Expert Fakes Bulk ───────────────────────────────────────────────
FIRST_NAMES = ['Ana','Bruno','Carla','Diego','Eduarda','Felipe','Gabriela','Henrique','Isabela','Joao','Karen','Lucas','Mariana','Natalia','Otavio','Patricia','Rafael','Sabrina','Thiago','Vanessa','William','Yasmin','Camila','Daniel','Eliana','Fernando','Giovanna','Heitor','Julia','Leonardo','Mateus','Olivia','Paulo','Rebeca','Samuel','Tatiana','Vinicius','Bianca','Cesar','Debora','Erick','Fabiana','Gustavo','Helena','Igor','Joana','Kelvin','Larissa','Marcos','Nicole','Pedro','Renata','Sergio','Taina','Wesley','Yuri']
LAST_NAMES = ['Silva','Santos','Oliveira','Souza','Lima','Pereira','Costa','Ferreira','Almeida','Ribeiro','Carvalho','Gomes','Martins','Araujo','Rocha','Dias','Nascimento','Mendes','Barbosa','Cardoso','Teixeira','Pinto','Moreira','Castro']
BULK_COLORS = COLORS + ['#00897b','#5e35b1','#d81b60','#3949ab']

@app.post("/api/expert/fakes/bulk")
async def create_expert_fakes_bulk(request: Request):
    user_id, expert, plan = await require_expert(request)
    if not expert:
        return Response(content='{"error":"not an expert"}', status_code=403, media_type="application/json")
    body = await request.json()
    meeting_id = str(body.get("meetingId", ""))
    requested = max(1, min(500, int(body.get("count", 0))))
    if not meeting_id:
        return Response(content='{"error":"meetingId required"}', status_code=400, media_type="application/json")
    expert_id = str(expert["_id"])
    to_create = requested
    if plan:
        current = await db.fake_profiles.count_documents({"expertId": expert_id, "meetingId": meeting_id})
        available = max(0, plan.get("maxFakeParticipants", 999) - current)
        to_create = min(requested, available)
        if to_create == 0:
            return Response(content='{"error":"Limite do plano atingido"}', status_code=403, media_type="application/json")
    existing = await db.fake_profiles.find({"expertId": expert_id, "meetingId": meeting_id}, {"name": 1}).to_list(10000)
    used = set(d["name"] for d in existing)
    docs = []
    attempts = 0
    while len(docs) < to_create and attempts < to_create * 20:
        attempts += 1
        name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
        if name in used:
            continue
        used.add(name)
        docs.append({"expertId": expert_id, "meetingId": meeting_id, "name": name, "avatarColor": random.choice(BULK_COLORS), "active": True, "createdAt": datetime.now(timezone.utc)})
    if not docs:
        return Response(content='{"error":"no names generated"}', status_code=500, media_type="application/json")
    result = await db.fake_profiles.insert_many(docs)
    ids = list(result.inserted_ids)
    stream_users = [{"id": f"fake_{str(oid)}", "role": "user", "name": docs[i]["name"]} for i, oid in enumerate(ids)]
    await asyncio.to_thread(stream_sync_upsert_users, stream_users)
    if stream_users:
        await asyncio.to_thread(stream_sync_channel_create_and_add, "messaging", meeting_id, stream_users[0]["id"], [u["id"] for u in stream_users])
    return {"ok": True, "created": len(docs)}

# ── Expert Comments ─────────────────────────────────────────────────
@app.get("/api/expert/comments")
async def get_expert_comments(request: Request):
    user_id, expert, plan = await require_expert(request)
    if not expert:
        return Response(content='{"error":"not an expert"}', status_code=403, media_type="application/json")
    meeting_id = request.query_params.get("meetingId")
    filt = {"expertId": str(expert["_id"])}
    if meeting_id:
        filt["meetingId"] = meeting_id
    comments = await db.scheduled_comments.find(filt).sort("delaySeconds", 1).to_list(10000)
    return {"comments": [{**c, "_id": str(c["_id"])} for c in comments]}

@app.post("/api/expert/comments")
async def create_expert_comment(request: Request):
    user_id, expert, plan = await require_expert(request)
    if not expert:
        return Response(content='{"error":"not an expert"}', status_code=403, media_type="application/json")
    body = await request.json()
    meeting_id = body.get("meetingId")
    fake_id = body.get("fakeProfileId")
    text = str(body.get("text", "")).strip()
    if not meeting_id or not fake_id or not text:
        return Response(content='{"error":"meetingId, fakeProfileId, text required"}', status_code=400, media_type="application/json")
    expert_id = str(expert["_id"])
    fake = await db.fake_profiles.find_one({"_id": ObjectId(fake_id), "expertId": expert_id})
    if not fake:
        return Response(content='{"error":"fake profile not found"}', status_code=404, media_type="application/json")
    if plan:
        count = await db.scheduled_comments.count_documents({"expertId": expert_id, "meetingId": meeting_id})
        if count >= plan.get("maxComments", 999):
            return Response(content='{"error":"Plan limit reached"}', status_code=403, media_type="application/json")
    doc = {"expertId": expert_id, "meetingId": meeting_id, "fakeProfileId": str(fake_id), "text": text, "delaySeconds": int(body.get("delaySeconds", 0)), "sent": False, "createdAt": datetime.now(timezone.utc)}
    result = await db.scheduled_comments.insert_one(doc)
    return {"ok": True, "comment": {**doc, "_id": str(result.inserted_id)}}

@app.delete("/api/expert/comments")
async def delete_expert_comment(request: Request):
    user_id, expert, plan = await require_expert(request)
    if not expert:
        return Response(content='{"error":"not an expert"}', status_code=403, media_type="application/json")
    expert_id = str(expert["_id"])
    cid = request.query_params.get("id")
    sent_only = request.query_params.get("sentOnly") == "true"
    meeting_id = request.query_params.get("meetingId")
    if sent_only and meeting_id:
        result = await db.scheduled_comments.delete_many({"expertId": expert_id, "meetingId": meeting_id, "sent": True})
        return {"ok": True, "deleted": result.deleted_count}
    if not cid:
        return Response(content='{"error":"id required"}', status_code=400, media_type="application/json")
    await db.scheduled_comments.delete_one({"_id": ObjectId(cid), "expertId": expert_id})
    return {"ok": True}

# ── Expert Comments Send ────────────────────────────────────────────
@app.post("/api/expert/comments/send")
async def send_expert_comment(request: Request):
    user_id, expert, plan = await require_expert(request)
    if not expert:
        return Response(content='{"error":"not an expert"}', status_code=403, media_type="application/json")
    body = await request.json()
    expert_id = str(expert["_id"])
    comment_id = body.get("commentId")
    if comment_id:
        c = await db.scheduled_comments.find_one({"_id": ObjectId(comment_id), "expertId": expert_id})
        if not c:
            return Response(content='{"error":"comment not found"}', status_code=404, media_type="application/json")
        meeting_id = str(c["meetingId"])
        fake_profile_id = str(c["fakeProfileId"])
        text = str(c["text"])
    else:
        meeting_id = str(body.get("meetingId", ""))
        fake_profile_id = str(body.get("fakeProfileId", ""))
        text = str(body.get("text", ""))
        if not meeting_id or not fake_profile_id or not text:
            return Response(content='{"error":"meetingId, fakeProfileId, text required"}', status_code=400, media_type="application/json")
    fake = await db.fake_profiles.find_one({"_id": ObjectId(fake_profile_id), "expertId": expert_id})
    if not fake:
        return Response(content='{"error":"fake profile not found"}', status_code=404, media_type="application/json")
    fake_stream_id = f"fake_{str(fake['_id'])}"
    await asyncio.to_thread(stream_sync_upsert_user, {"id": fake_stream_id, "role": "user", "name": fake["name"], "image": fake.get("imageUrl")})
    await asyncio.to_thread(stream_sync_channel_create_and_add, "messaging", meeting_id, fake_stream_id, [fake_stream_id])
    result = await asyncio.to_thread(stream_sync_send_message, "messaging", meeting_id, fake_stream_id, text)
    if comment_id:
        await db.scheduled_comments.update_one({"_id": ObjectId(comment_id)}, {"$set": {"sent": True, "sentAt": datetime.now(timezone.utc)}})
    msg_id = None
    if result and isinstance(result, dict):
        msg_id = result.get("message", {}).get("id")
    return {"ok": True, "messageId": msg_id}

# ── Expert Comments Bulk ────────────────────────────────────────────
@app.post("/api/expert/comments/bulk")
async def bulk_expert_comments(request: Request):
    user_id, expert, plan = await require_expert(request)
    if not expert:
        return Response(content='{"error":"not an expert"}', status_code=403, media_type="application/json")
    body = await request.json()
    expert_id = str(expert["_id"])
    meeting_id = str(body.get("meetingId", ""))
    raw_texts = body.get("texts", [])
    texts = [str(t).strip() for t in raw_texts if str(t).strip()]
    delay_min = max(0, int(body.get("delayMin", 5)))
    delay_max = max(delay_min, int(body.get("delayMax", 60)))
    shuffle = body.get("shuffleFakes", True)
    if not meeting_id:
        return Response(content='{"error":"meetingId required"}', status_code=400, media_type="application/json")
    if not texts:
        return Response(content='{"error":"no texts provided"}', status_code=400, media_type="application/json")
    fakes = await db.fake_profiles.find({"expertId": expert_id, "meetingId": meeting_id, "active": True}).to_list(10000)
    if not fakes:
        return Response(content='{"error":"No fake participants in this meeting."}', status_code=400, media_type="application/json")
    to_create = len(texts)
    if plan:
        current = await db.scheduled_comments.count_documents({"expertId": expert_id, "meetingId": meeting_id})
        available = max(0, plan.get("maxComments", 999) - current)
        to_create = min(len(texts), available)
        if to_create == 0:
            return Response(content='{"error":"Limite do plano atingido"}', status_code=403, media_type="application/json")
    docs = []
    for i in range(to_create):
        fake = random.choice(fakes) if shuffle else fakes[i % len(fakes)]
        delay = delay_min if delay_max == delay_min else random.randint(delay_min, delay_max)
        docs.append({"expertId": expert_id, "meetingId": meeting_id, "fakeProfileId": str(fake["_id"]), "text": texts[i], "delaySeconds": delay, "sent": False, "createdAt": datetime.now(timezone.utc)})
    await db.scheduled_comments.insert_many(docs)
    return {"ok": True, "created": len(docs), "skipped": len(texts) - to_create}

# ── Expert Comments Multi ───────────────────────────────────────────
@app.post("/api/expert/comments/multi")
async def multi_expert_comments(request: Request):
    user_id, expert, plan = await require_expert(request)
    if not expert:
        return Response(content='{"error":"not an expert"}', status_code=403, media_type="application/json")
    body = await request.json()
    expert_id = str(expert["_id"])
    meeting_id = str(body.get("meetingId", ""))
    raw_items = body.get("items", [])
    if not meeting_id:
        return Response(content='{"error":"meetingId required"}', status_code=400, media_type="application/json")
    items = [{"fakeProfileId": str(it.get("fakeProfileId", "")).strip(), "text": str(it.get("text", "")).strip(), "delaySeconds": max(0, int(it.get("delaySeconds", 0)))} for it in raw_items if str(it.get("fakeProfileId", "")).strip() and str(it.get("text", "")).strip()]
    if not items:
        return Response(content='{"error":"No valid rows"}', status_code=400, media_type="application/json")
    fake_ids = list(set(it["fakeProfileId"] for it in items))
    obj_ids = [ObjectId(i) for i in fake_ids]
    fake_docs = await db.fake_profiles.find({"_id": {"$in": obj_ids}, "expertId": expert_id, "meetingId": meeting_id}).to_list(10000)
    valid_ids = set(str(d["_id"]) for d in fake_docs)
    filtered = [it for it in items if it["fakeProfileId"] in valid_ids]
    if not filtered:
        return Response(content='{"error":"No items refer to a valid fake"}', status_code=400, media_type="application/json")
    to_create = len(filtered)
    if plan:
        current = await db.scheduled_comments.count_documents({"expertId": expert_id, "meetingId": meeting_id})
        available = max(0, plan.get("maxComments", 999) - current)
        to_create = min(len(filtered), available)
        if to_create == 0:
            return Response(content='{"error":"Limite do plano atingido"}', status_code=403, media_type="application/json")
    docs = [{"expertId": expert_id, "meetingId": meeting_id, "fakeProfileId": it["fakeProfileId"], "text": it["text"], "delaySeconds": it["delaySeconds"], "sent": False, "createdAt": datetime.now(timezone.utc)} for it in filtered[:to_create]]
    await db.scheduled_comments.insert_many(docs)
    return {"ok": True, "created": len(docs), "skipped": len(items) - len(docs)}

# ── Expert Comments Broadcast ───────────────────────────────────────
@app.post("/api/expert/comments/broadcast")
async def broadcast_expert_comments(request: Request):
    user_id, expert, plan = await require_expert(request)
    if not expert:
        return Response(content='{"error":"not an expert"}', status_code=403, media_type="application/json")
    body = await request.json()
    expert_id = str(expert["_id"])
    meeting_id = str(body.get("meetingId", ""))
    text = str(body.get("text", "")).strip()
    interval = max(0, int(body.get("intervalSeconds", 0)))
    start_delay = max(0, int(body.get("startDelaySeconds", 0)))
    if not meeting_id:
        return Response(content='{"error":"meetingId required"}', status_code=400, media_type="application/json")
    if not text:
        return Response(content='{"error":"text required"}', status_code=400, media_type="application/json")
    fakes = await db.fake_profiles.find({"expertId": expert_id, "meetingId": meeting_id, "active": True}).to_list(10000)
    if not fakes:
        return Response(content='{"error":"No fake participants"}', status_code=400, media_type="application/json")
    to_create = len(fakes)
    if plan:
        current = await db.scheduled_comments.count_documents({"expertId": expert_id, "meetingId": meeting_id})
        available = max(0, plan.get("maxComments", 999) - current)
        to_create = min(len(fakes), available)
        if to_create == 0:
            return Response(content='{"error":"Limite do plano atingido"}', status_code=403, media_type="application/json")
    docs = [{"expertId": expert_id, "meetingId": meeting_id, "fakeProfileId": str(fakes[i]["_id"]), "text": text, "delaySeconds": start_delay + i * interval, "sent": False, "createdAt": datetime.now(timezone.utc)} for i in range(to_create)]
    await db.scheduled_comments.insert_many(docs)
    return {"ok": True, "created": len(docs), "skipped": len(fakes) - to_create}

# ── Expert Library ──────────────────────────────────────────────────
@app.get("/api/expert/library")
async def get_expert_library(request: Request):
    user_id, expert, plan = await require_expert(request)
    if not expert:
        return Response(content='{"error":"not an expert"}', status_code=403, media_type="application/json")
    items = await db.comment_library.find({"expertId": str(expert["_id"])}).sort("createdAt", -1).to_list(10000)
    return {"items": [{**i, "_id": str(i["_id"])} for i in items]}

@app.post("/api/expert/library")
async def create_expert_library(request: Request):
    user_id, expert, plan = await require_expert(request)
    if not expert:
        return Response(content='{"error":"not an expert"}', status_code=403, media_type="application/json")
    body = await request.json()
    tag = str(body.get("tag", "")).strip()[:40] if body.get("tag") else None
    texts = body.get("texts", [body.get("text")] if body.get("text") else [])
    cleaned = [str(t).strip() for t in texts if str(t).strip()]
    if not cleaned:
        return Response(content='{"error":"text(s) required"}', status_code=400, media_type="application/json")
    docs = [{"expertId": str(expert["_id"]), "text": t, "tag": tag, "createdAt": datetime.now(timezone.utc)} for t in cleaned]
    await db.comment_library.insert_many(docs)
    return {"ok": True, "created": len(docs)}

@app.delete("/api/expert/library")
async def delete_expert_library(request: Request):
    user_id, expert, plan = await require_expert(request)
    if not expert:
        return Response(content='{"error":"not an expert"}', status_code=403, media_type="application/json")
    expert_id = str(expert["_id"])
    all_param = request.query_params.get("all")
    ids_param = request.query_params.get("ids")
    id_param = request.query_params.get("id")
    if all_param == "true":
        r = await db.comment_library.delete_many({"expertId": expert_id})
        return {"ok": True, "deleted": r.deleted_count}
    if ids_param:
        id_list = [s.strip() for s in ids_param.split(",") if s.strip()]
        r = await db.comment_library.delete_many({"_id": {"$in": [ObjectId(i) for i in id_list]}, "expertId": expert_id})
        return {"ok": True, "deleted": r.deleted_count}
    if not id_param:
        return Response(content='{"error":"id required"}', status_code=400, media_type="application/json")
    r = await db.comment_library.delete_one({"_id": ObjectId(id_param), "expertId": expert_id})
    return {"ok": True, "deleted": r.deleted_count}

logging.getLogger("moogle-meet").info("Moogle Meet API ready")
