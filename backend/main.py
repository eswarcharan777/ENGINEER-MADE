from fastapi import Depends, FastAPI, Header, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials as firebase_credentials
from google.auth.credentials import AnonymousCredentials
from pydantic import BaseModel
import httpx
import os
import logging
import hashlib
import base64
import re
import asyncio
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from roadmaps import ADDITIONAL_LEARNING_PATHS
from catalog_repository import CatalogRepository, create_firestore_client

# Always load the backend environment beside this module. Relying on the
# process working directory caused Firebase settings to disappear when Uvicorn
# was launched from another directory.
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
logger = logging.getLogger("engineer_kingdom.auth")

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_UPLOAD_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


class VerificationOnlyCredential(firebase_credentials.Base):
    """Credential for local ID-token verification without Google ADC.

    Firebase verifies ID-token signatures with Google's public certificates.
    The anonymous credential prevents the Admin SDK from attempting ADC while
    preserving full signature, issuer, audience, and expiry validation.
    """

    def __init__(self) -> None:
        self._credential = AnonymousCredentials()

    def get_credential(self):
        return self._credential


def _admin_emails() -> set[str]:
    return {
        email.strip().lower()
        for email in os.getenv("ADMIN_EMAILS", "").split(",")
        if email.strip()
    }


def _ensure_firebase_admin() -> None:
    if not firebase_admin._apps:
        project_id = os.getenv("FIREBASE_PROJECT_ID", "").strip()
        has_server_credentials = bool(
            os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
            or os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
        )
        credential = None if has_server_credentials else VerificationOnlyCredential()
        firebase_admin.initialize_app(
            credential=credential,
            options={"projectId": project_id} if project_id else None,
        )


def require_admin(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="A Firebase ID token is required")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="A Firebase ID token is required")
    try:
        _ensure_firebase_admin()
        claims = firebase_auth.verify_id_token(token)
    except Exception as error:
        logger.warning("Firebase ID-token verification failed: %s: %s", type(error).__name__, error)
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase ID token")

    email = str(claims.get("email", "")).lower()
    # The ID token has already been cryptographically verified above. An exact
    # server-side allowlist match is therefore sufficient even when a legacy
    # email/password account has not completed Firebase's verification flow.
    allowlisted_email = email.strip() in _admin_emails()
    if claims.get("admin") is not True and not allowlisted_email:
        logger.warning("Admin access denied for authenticated email: %s", email or "<missing>")
        raise HTTPException(status_code=403, detail="Administrator access is required")
    return claims


def require_user(authorization: str | None = Header(default=None)) -> dict:
    """Require a valid Firebase user without granting any admin privileges."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="A Firebase ID token is required")
    try:
        _ensure_firebase_admin()
        return firebase_auth.verify_id_token(authorization.removeprefix("Bearer ").strip())
    except Exception as error:
        logger.warning("Firebase ID-token verification failed: %s", type(error).__name__)
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase ID token")


def require_user(authorization: str | None = Header(default=None)) -> dict:
    """Verify an ordinary Firebase session without granting any elevated role."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="A Firebase ID token is required")
    try:
        _ensure_firebase_admin()
        return firebase_auth.verify_id_token(authorization.removeprefix("Bearer ").strip())
    except Exception as error:
        logger.warning("Firebase ID-token verification failed: %s", type(error).__name__)
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase ID token")


def platform_database():
    """The server-only Firestore client used for private platform operations."""
    database = getattr(CATALOG, "_db", None)
    if database is None:
        raise HTTPException(
            status_code=503,
            detail="Platform operations need a server-side Firestore connection.",
        )
    return database


def _server_time():
    # Server timestamps are preferred in Firestore, while a UTC timestamp keeps
    # local tests and alternate Firestore-compatible backends usable.
    try:
        from google.cloud import firestore as google_firestore
        return google_firestore.SERVER_TIMESTAMP
    except Exception:
        return datetime.now(timezone.utc)


def audit_action(database, admin: dict, action: str, target: str, metadata: dict | None = None) -> None:
    """Write an append-only, server-authored audit event for admin changes."""
    database.collection("auditLogs").add({
        "action": action,
        "target": target,
        "actorUid": admin.get("uid", "unknown"),
        "actorEmail": admin.get("email", ""),
        "metadata": metadata or {},
        "createdAt": _server_time(),
    })


def _timestamp_to_datetime(value: object) -> datetime | None:
    """Normalize Firestore timestamps without exposing implementation details."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    to_datetime = getattr(value, "to_datetime", None)
    if callable(to_datetime):
        parsed = to_datetime()
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    return None


def learner_directory() -> dict:
    """Return a privacy-minimised, administrator-only learner directory."""
    database = getattr(CATALOG, "_db", None)
    if database is None:
        return {"available": False, "message": "Learner analytics needs a server-side Firestore connection.", "totalUsers": 0, "activeUsers": 0, "activeWindowMinutes": 5, "users": []}
    try:
        active_after = datetime.now(timezone.utc) - timedelta(minutes=5)
        users = []
        for snapshot in database.collection("users").stream():
            record = snapshot.to_dict() or {}
            profile = record.get("profile") or {}
            last_active = _timestamp_to_datetime(record.get("lastActiveAt"))
            created_at = _timestamp_to_datetime(record.get("createdAt"))
            completed = record.get("completedLessons") or []
            users.append({
                "id": snapshot.id,
                "name": profile.get("name") or record.get("name") or "Learner",
                "email": profile.get("email") or record.get("email") or "",
                "collegeName": profile.get("collegeName") or "—",
                "profileCompleted": bool(record.get("profileCompleted")),
                "completedLessons": len(completed) if isinstance(completed, list) else 0,
                "createdAt": created_at.isoformat() if created_at else None,
                "lastActiveAt": last_active.isoformat() if last_active else None,
                "isActive": bool(last_active and last_active >= active_after),
                "role": "admin" if bool(record.get("role") == "admin") else "learner",
            })
        users.sort(key=lambda learner: learner["lastActiveAt"] or "", reverse=True)
        return {"available": True, "totalUsers": len(users), "activeUsers": sum(1 for learner in users if learner["isActive"]), "activeWindowMinutes": 5, "users": users[:100]}
    except Exception as error:
        logger.exception("Could not load administrator learner analytics")
        return {"available": False, "message": f"Learner analytics is temporarily unavailable: {type(error).__name__}", "totalUsers": 0, "activeUsers": 0, "activeWindowMinutes": 5, "users": []}

# Accept the key if it was pasted as a bare line in the local .env file. This
# keeps the secret server-side and lets the app recover from that common setup
# mistake; GEMINI_API_KEY=... remains the recommended format.
if not (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")):
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    try:
        with open(env_path, "r", encoding="utf-8") as env_file:
            bare_values = [line.strip() for line in env_file if line.strip() and not line.lstrip().startswith("#") and "=" not in line]
        if bare_values:
            os.environ["GEMINI_API_KEY"] = bare_values[0]
    except OSError:
        pass

app = FastAPI(title="Engineer Made API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Course Data ──────────────────────────────────────────────────────────────

LEARNING_PATHS = {
    "ai-engineer": {
        "id": "ai-engineer",
        "title": "AI / ML Engineer",
        "description": "Master artificial intelligence and machine learning from fundamentals to production deployment.",
        "icon": "🤖",
        "color": "#7C3AED",
        "skills": ["Python", "TensorFlow", "PyTorch", "NLP", "Computer Vision", "MLOps"],
        "duration": "6 months",
        "modules": [
            {
                "id": "ai-1",
                "title": "Python for AI",
                "lessons": [
                    {"id": "ai-1-1", "title": "Python Fundamentals & NumPy", "type": "video", "videoId": "rfscVS0vtbw", "duration": "45 min"},
                    {"id": "ai-1-2", "title": "Pandas & Data Manipulation", "type": "video", "videoId": "vmEHCJofslg", "duration": "60 min"},
                    {"id": "ai-1-3", "title": "Data Visualization with Matplotlib", "type": "video", "videoId": "3Xc3CA655Y4", "duration": "30 min"},
                    {"id": "ai-1-4", "title": "Python for AI - Audio Recap", "type": "audio", "audioUrl": "", "duration": "15 min"},
                ]
            },
            {
                "id": "ai-2",
                "title": "Machine Learning Foundations",
                "lessons": [
                    {"id": "ai-2-1", "title": "What is Machine Learning?", "type": "video", "videoId": "ukzFI9rgwfU", "duration": "40 min"},
                    {"id": "ai-2-2", "title": "Supervised vs Unsupervised Learning", "type": "video", "videoId": "1FZ0A1QCMWc", "duration": "35 min"},
                    {"id": "ai-2-3", "title": "Scikit-Learn Crash Course", "type": "video", "videoId": "0B5eIE_1vpU", "duration": "50 min"},
                ]
            },
            {
                "id": "ai-3",
                "title": "Deep Learning & Neural Networks",
                "lessons": [
                    {"id": "ai-3-1", "title": "Neural Networks Explained", "type": "video", "videoId": "aircAruvnKk", "duration": "45 min"},
                    {"id": "ai-3-2", "title": "TensorFlow 2.0 Complete Course", "type": "video", "videoId": "tPYj3fFJGjk", "duration": "60 min"},
                    {"id": "ai-3-3", "title": "PyTorch for Beginners", "type": "video", "videoId": "V_xro1bcAuA", "duration": "55 min"},
                ]
            },
        ],
        "resources": [
            {"title": "Deep Learning Specialization - Andrew Ng", "url": "https://www.coursera.org/specializations/deep-learning", "type": "course"},
            {"title": "Hands-On Machine Learning (Book)", "url": "https://www.oreilly.com/library/view/hands-on-machine-learning/9781098125967/", "type": "book"},
            {"title": "Papers With Code", "url": "https://paperswithcode.com/", "type": "tool"},
            {"title": "Kaggle Datasets & Competitions", "url": "https://www.kaggle.com/", "type": "tool"},
            {"title": "Google Colab", "url": "https://colab.research.google.com/", "type": "tool"},
        ],
    },
    "fullstack-engineer": {
        "id": "fullstack-engineer",
        "title": "Full Stack Engineer",
        "description": "Build modern web applications end-to-end with React, Node.js, databases, and cloud deployment.",
        "icon": "⚡",
        "color": "#2563EB",
        "skills": ["React", "Node.js", "TypeScript", "PostgreSQL", "Docker", "AWS"],
        "duration": "6 months",
        "modules": [
            {
                "id": "fs-1",
                "title": "Frontend Fundamentals",
                "lessons": [
                    {"id": "fs-1-1", "title": "HTML & CSS Crash Course", "type": "video", "videoId": "qz0aGYrrlhU", "duration": "60 min"},
                    {"id": "fs-1-2", "title": "JavaScript ES6+ Complete", "type": "video", "videoId": "PkZNo7MFNFg", "duration": "55 min"},
                    {"id": "fs-1-3", "title": "React JS Full Course 2024", "type": "video", "videoId": "CgkZ7MvWUAA", "duration": "70 min"},
                ]
            },
            {
                "id": "fs-2",
                "title": "Backend Development",
                "lessons": [
                    {"id": "fs-2-1", "title": "Node.js & Express Complete", "type": "video", "videoId": "Oe421EPjeBE", "duration": "60 min"},
                    {"id": "fs-2-2", "title": "REST API Design Best Practices", "type": "video", "videoId": "DkSeXHS0kAQ", "duration": "18 min"},
                    {"id": "fs-2-3", "title": "PostgreSQL Full Course", "type": "video", "videoId": "85pG_pDkITY", "duration": "50 min"},
                ]
            },
        ],
        "resources": [
            {"title": "The Odin Project", "url": "https://www.theodinproject.com/", "type": "course"},
            {"title": "freeCodeCamp", "url": "https://www.freecodecamp.org/", "type": "course"},
            {"title": "MDN Web Docs", "url": "https://developer.mozilla.org/", "type": "docs"},
            {"title": "JavaScript.info", "url": "https://javascript.info/", "type": "docs"},
        ],
    },
    "data-engineer": {
        "id": "data-engineer",
        "title": "Data Engineer",
        "description": "Design and build data pipelines, warehouses, and analytics infrastructure at scale.",
        "icon": "📊",
        "color": "#059669",
        "skills": ["Python", "SQL", "Apache Spark", "Airflow", "Kafka", "BigQuery"],
        "duration": "5 months",
        "modules": [
            {
                "id": "de-1",
                "title": "SQL & Databases",
                "lessons": [
                    {"id": "de-1-1", "title": "SQL Full Course for Beginners", "type": "video", "videoId": "HXV3zeQKqGY", "duration": "55 min"},
                    {"id": "de-1-2", "title": "Database Design & Normalization", "type": "video", "videoId": "ztHopE5Wnpc", "duration": "40 min"},
                ]
            },
            {
                "id": "de-2",
                "title": "Data Pipeline Engineering",
                "lessons": [
                    {"id": "de-2-1", "title": "Apache Spark with Python", "type": "video", "videoId": "_C8kWso4ne4", "duration": "60 min"},
                    {"id": "de-2-2", "title": "Apache Airflow Tutorial", "type": "video", "videoId": "AHMm1wfGuHE", "duration": "45 min"},
                ]
            },
        ],
        "resources": [
            {"title": "DataCamp - Data Engineering Track", "url": "https://www.datacamp.com/tracks/data-engineer-with-python", "type": "course"},
            {"title": "Designing Data-Intensive Applications (Book)", "url": "https://dataintensive.net/", "type": "book"},
        ],
    },
    "devops-engineer": {
        "id": "devops-engineer",
        "title": "DevOps / Cloud Engineer",
        "description": "Master CI/CD, containerization, infrastructure as code, and cloud platforms.",
        "icon": "☁️",
        "color": "#DC2626",
        "skills": ["Docker", "Kubernetes", "AWS", "Terraform", "CI/CD", "Linux"],
        "duration": "5 months",
        "modules": [
            {
                "id": "do-1",
                "title": "Linux & Networking",
                "lessons": [
                    {"id": "do-1-1", "title": "Linux Full Course", "type": "video", "videoId": "sWbUDq4S6Y8", "duration": "50 min"},
                    {"id": "do-1-2", "title": "Networking Fundamentals", "type": "video", "videoId": "qiQR5rTSshw", "duration": "45 min"},
                ]
            },
            {
                "id": "do-2",
                "title": "Containers & Orchestration",
                "lessons": [
                    {"id": "do-2-1", "title": "Docker Complete Course", "type": "video", "videoId": "fqMOX6JJhGo", "duration": "60 min"},
                    {"id": "do-2-2", "title": "Kubernetes Crash Course", "type": "video", "videoId": "s_o8dwzRlu4", "duration": "55 min"},
                ]
            },
        ],
        "resources": [
            {"title": "KodeKloud - DevOps Learning", "url": "https://kodekloud.com/", "type": "course"},
            {"title": "AWS Free Tier", "url": "https://aws.amazon.com/free/", "type": "tool"},
        ],
    },
    "cybersecurity-engineer": {
        "id": "cybersecurity-engineer",
        "title": "Cybersecurity Engineer",
        "description": "Learn ethical hacking, penetration testing, network security, and security operations.",
        "icon": "🔒",
        "color": "#B45309",
        "skills": ["Ethical Hacking", "Network Security", "SIEM", "Penetration Testing", "Linux", "Python"],
        "duration": "6 months",
        "modules": [
            {
                "id": "cs-1",
                "title": "Security Fundamentals",
                "lessons": [
                    {"id": "cs-1-1", "title": "Cybersecurity Full Course", "type": "video", "videoId": "U_P23SqJaDc", "duration": "60 min"},
                    {"id": "cs-1-2", "title": "Ethical Hacking in 12 Hours", "type": "video", "videoId": "fNzpcB7ODxQ", "duration": "55 min"},
                ]
            },
        ],
        "resources": [
            {"title": "TryHackMe", "url": "https://tryhackme.com/", "type": "tool"},
            {"title": "Hack The Box", "url": "https://www.hackthebox.com/", "type": "tool"},
            {"title": "OWASP Top 10", "url": "https://owasp.org/www-project-top-ten/", "type": "docs"},
        ],
    },
    "embedded-iot-engineer": {
        "id": "embedded-iot-engineer",
        "title": "Embedded / IoT Engineer",
        "description": "Build embedded systems and IoT solutions with microcontrollers, sensors, and edge computing.",
        "icon": "🔌",
        "color": "#7C3AED",
        "skills": ["C/C++", "Arduino", "Raspberry Pi", "MQTT", "Embedded Linux", "PCB Design"],
        "duration": "5 months",
        "modules": [
            {
                "id": "iot-1",
                "title": "Embedded Systems Basics",
                "lessons": [
                    {"id": "iot-1-1", "title": "Arduino Full Course", "type": "video", "videoId": "zJ-LqeX_fLU", "duration": "50 min"},
                    {"id": "iot-1-2", "title": "Raspberry Pi Projects", "type": "video", "videoId": "BpJCAafw2qE", "duration": "38 min"},
                ]
            },
        ],
        "resources": [
            {"title": "Arduino Official Docs", "url": "https://docs.arduino.cc/", "type": "docs"},
            {"title": "Raspberry Pi Foundation", "url": "https://www.raspberrypi.org/", "type": "tool"},
        ],
    },
}

LEARNING_PATHS.update(ADDITIONAL_LEARNING_PATHS)
CATALOG = CatalogRepository(LEARNING_PATHS, create_firestore_client())


class CertificateIssueRequest(BaseModel):
    track_title: str = "Engineer Made learning milestone"


def _certificate_database():
    database = getattr(CATALOG, "_db", None)
    if database is None:
        raise HTTPException(status_code=503, detail="Certificate verification needs a server-side Firestore connection.")
    return database


def _certificate_code(uid: str) -> str:
    # The code is deterministic for one learner but does not expose their UID.
    digest = hashlib.sha256(f"engineer-kingdom-certificate:{uid}".encode("utf-8")).hexdigest()[:12].upper()
    return f"EK-{digest}"


@app.post("/api/certificates/issue")
def issue_certificate(request: CertificateIssueRequest, claims: dict = Depends(require_user)):
    database = _certificate_database()
    uid = str(claims.get("uid", ""))
    learner = database.collection("users").document(uid).get().to_dict() or {}
    completed = learner.get("completedLessons") or []
    if not isinstance(completed, list) or len(completed) < 10:
        raise HTTPException(status_code=409, detail="Complete at least 10 lessons to unlock a verified certificate.")
    profile = learner.get("profile") or {}
    code = _certificate_code(uid)
    certificate = {
        "code": code,
        "learnerName": profile.get("name") or learner.get("name") or claims.get("name") or "Engineer Made learner",
        "trackTitle": request.track_title.strip()[:160] or "Engineer Made learning milestone",
        "completedLessons": len(completed),
        "status": "valid",
        "issuedAt": datetime.now(timezone.utc),
    }
    database.collection("certificates").document(code).set(certificate, merge=True)
    return {**certificate, "issuedAt": certificate["issuedAt"].isoformat()}


@app.get("/api/certificates/{code}")
def verify_certificate(code: str):
    normalized = code.strip().upper()
    if not normalized.startswith("EK-") or len(normalized) > 64:
        raise HTTPException(status_code=404, detail="Certificate not found")
    certificate = _certificate_database().collection("certificates").document(normalized).get()
    if not certificate.exists:
        raise HTTPException(status_code=404, detail="Certificate not found")
    record = certificate.to_dict() or {}
    if record.get("status") != "valid":
        raise HTTPException(status_code=410, detail="This certificate is no longer valid")
    issued_at = _timestamp_to_datetime(record.get("issuedAt"))
    return {
        "valid": True,
        "code": normalized,
        "learnerName": record.get("learnerName", "Engineer Made learner"),
        "trackTitle": record.get("trackTitle", "Engineer Made learning milestone"),
        "completedLessons": int(record.get("completedLessons", 0)),
        "issuedAt": issued_at.isoformat() if issued_at else None,
    }


@app.get("/")
def root():
    return {"message": "Engineer Made API", "version": "1.0.0"}


@app.get("/api/health")
@app.get("/health")
def health():
    return {"status": "ok"}


class TutorMessage(BaseModel):
    role: str
    text: str


class TutorRequest(BaseModel):
    message: str
    history: list[TutorMessage] = []
    learner_name: str = "Engineer"


class RepositoryRequest(BaseModel):
    url: str


class DailyChallengeRequest(BaseModel):
    challenge_id: str


class CompilerRequest(BaseModel):
    language: str
    code: str
    stdin: str = ""


@app.post("/api/compiler/run")
async def run_compiler(request: CompilerRequest, _user: dict = Depends(require_user)):
    """Execute learner code only through a separately configured sandbox service."""
    runtimes = {"c": "c", "cpp": "c++", "python": "python", "java": "java", "javascript": "javascript"}
    language = request.language.strip().lower()
    code = request.code.replace("\r\n", "\n")
    if language not in runtimes:
        raise HTTPException(status_code=400, detail="Choose C, C++, Python, Java, or JavaScript.")
    if not code.strip() or len(code) > 12_000:
        raise HTTPException(status_code=400, detail="Code must be between 1 and 12,000 characters.")
    if len(request.stdin) > 4_000:
        raise HTTPException(status_code=400, detail="Standard input must be 4,000 characters or fewer.")

    runner_url = os.getenv("CODE_RUNNER_URL", "").strip()
    runner_token = os.getenv("CODE_RUNNER_TOKEN", "").strip()
    if not runner_url:
        raise HTTPException(status_code=503, detail="Online compiler is not configured yet. Set CODE_RUNNER_URL to a sandboxed Piston-compatible runner.")

    headers = {"Content-Type": "application/json"}
    if runner_token:
        headers["Authorization"] = f"Bearer {runner_token}"
    payload = {
        "language": runtimes[language], "version": "*", "files": [{"content": code}], "stdin": request.stdin,
        "compile_timeout": 10_000, "run_timeout": 3_000,
        "compile_memory_limit": 128_000_000, "run_memory_limit": 128_000_000,
    }
    try:
        async with httpx.AsyncClient(timeout=18.0) as client:
            response = await client.post(runner_url, headers=headers, json=payload)
        if response.status_code >= 400:
            logger.warning("Code runner failed: status=%s", response.status_code)
            raise HTTPException(status_code=502, detail="The online compiler rejected this run. Check the sandbox configuration and retry.")
        result = response.json()
        run = result.get("run", {})
        compile_result = result.get("compile", {})
        output = run.get("output") or compile_result.get("output") or "Program finished with no output."
        return {"output": str(output)[:12_000], "exitCode": run.get("code"), "signal": run.get("signal"), "language": result.get("language", runtimes[language])}
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="The online compiler timed out. Simplify the program and retry.")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not reach the online compiler sandbox.")


@app.post("/api/ai-tutor/chat")
@app.post("/ai-tutor/chat")
async def ai_tutor_chat(request: TutorRequest):
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Gemini is not configured. Add GEMINI_API_KEY to backend/.env.")
    question = request.message.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Please enter a question.")
    if len(question) > 4000:
        raise HTTPException(status_code=400, detail="Question is too long.")

    contents = []
    for item in request.history[-10:]:
        if item.role in {"user", "assistant"} and item.text.strip():
            contents.append({"role": "user" if item.role == "user" else "model", "parts": [{"text": item.text[:6000]}]})
    contents.append({"role": "user", "parts": [{"text": question}]})
    payload = {
        "system_instruction": {"parts": [{"text": (
            "You are Engineer Made AI Tutor, a friendly and accurate tutor for engineering students. "
            "Teach step by step, adapt to the learner level, use concise headings and examples, define symbols and units, "
            "and mention safety limitations for hazardous electrical, mechanical or chemical work. "
            "Support English, Hindi and Hinglish, following the language used by the learner. "
            "Do not invent facts, courses, marks or job guarantees. End with one useful follow-up question."
        )}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.45, "maxOutputTokens": 1400},
    }
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
                headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                json=payload,
            )
        if response.status_code >= 400:
            detail = response.json().get("error", {}).get("message", "Gemini request failed")
            raise HTTPException(status_code=502, detail=detail)
        data = response.json()
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        answer = "\n".join(part.get("text", "") for part in parts if part.get("text")).strip()
        if not answer:
            raise HTTPException(status_code=502, detail="Gemini returned an empty response.")
        return {"answer": answer, "model": "gemini-2.5-flash"}
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="The AI tutor took too long to respond. Please retry.")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not connect to the Gemini service.")


@app.post("/api/ai-tutor/vision")
async def ai_tutor_vision(
    file: UploadFile = File(...),
    context: str = Form(default=""),
    doubt_kind: str = Form(default="Engineering reference"),
    user: dict = Depends(require_user),
):
    """Analyze one learner-supplied engineering image or PDF with Gemini Vision.

    The upload is processed in memory only; it is not made public or stored as
    platform content. The authenticated learner's written context remains the
    primary source for safe, useful guidance.
    """
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"}
    if not api_key:
        raise HTTPException(status_code=503, detail="Gemini is not configured. Add GEMINI_API_KEY to backend/.env.")
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=415, detail="Use a JPG, PNG, WebP, GIF, or PDF reference.")
    content = await file.read(5 * 1024 * 1024 + 1)
    if not content or len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="References must be between 1 byte and 5 MB.")
    prompt = (
        "You are Engineer Made's engineering visual tutor. Analyze the supplied learner reference as a "
        f"{doubt_kind[:80]}. Their context is: {context[:3000] or 'No written context supplied.'} "
        "Explain what is visible, identify likely issues or concepts, give a numbered diagnostic process, "
        "and state safety limits for electrical, mechanical, chemical, or high-voltage work. Do not claim "
        "to read tiny or unclear labels; ask a precise follow-up where needed."
    )
    payload = {
        "contents": [{"role": "user", "parts": [
            {"text": prompt},
            {"inline_data": {"mime_type": file.content_type, "data": base64.b64encode(content).decode("ascii")}},
        ]}],
        "generationConfig": {"temperature": 0.25, "maxOutputTokens": 1600},
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
                headers={"x-goog-api-key": api_key, "Content-Type": "application/json"}, json=payload,
            )
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail=response.json().get("error", {}).get("message", "Gemini Vision request failed"))
        parts = response.json().get("candidates", [{}])[0].get("content", {}).get("parts", [])
        answer = "\n".join(part.get("text", "") for part in parts if part.get("text")).strip()
        if not answer:
            raise HTTPException(status_code=502, detail="Gemini Vision returned an empty response.")
        return {"answer": answer, "fileName": file.filename or "reference", "processed": True, "stored": False, "learner": user.get("uid")}
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Visual analysis took too long. Please retry with a smaller reference.")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not connect to Gemini Vision.")


def _github_repository_parts(url: str) -> tuple[str, str]:
    match = re.fullmatch(
        r"https?://(?:www\.)?github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+?)(?:\.git)?/?",
        url.strip(),
    )
    if not match:
        raise HTTPException(status_code=400, detail="Enter a public GitHub repository URL, for example https://github.com/user/repository")
    return match.group(1), match.group(2)


@app.post("/api/github/repository-analysis")
async def github_repository_analysis(request: RepositoryRequest, _user: dict = Depends(require_user)):
    """Fetch public GitHub metadata and score an engineering portfolio transparently."""
    owner, repository = _github_repository_parts(request.url)
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "Engineer-Made"}
    token = os.getenv("GITHUB_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        async with httpx.AsyncClient(timeout=18.0, follow_redirects=True) as client:
            repo_response, readme_response = await asyncio.gather(
                client.get(f"https://api.github.com/repos/{owner}/{repository}", headers=headers),
                client.get(f"https://api.github.com/repos/{owner}/{repository}/readme", headers=headers),
            )
        if repo_response.status_code == 404:
            raise HTTPException(status_code=404, detail="GitHub could not find that public repository.")
        if repo_response.status_code == 403:
            raise HTTPException(status_code=429, detail="GitHub rate limit reached. Add GITHUB_TOKEN on the server or retry later.")
        if repo_response.status_code >= 400:
            raise HTTPException(status_code=502, detail="GitHub could not load this repository right now.")
        repo = repo_response.json()
        readme_present = readme_response.status_code == 200
        documentation = 35 if readme_present else 8
        documentation += 15 if (repo.get("description") or "").strip() else 0
        code_quality = min(100, 25 + (20 if repo.get("language") else 0) + (15 if repo.get("size", 0) > 20 else 0) + (15 if not repo.get("archived") else 0))
        portfolio = min(100, 20 + (25 if repo.get("homepage") else 0) + (20 if repo.get("topics") else 0) + (15 if repo.get("license") else 0) + (10 if repo.get("stargazers_count", 0) > 0 else 0))
        maintenance = min(100, 25 + (25 if repo.get("updated_at") else 0) + (20 if repo.get("open_issues_count", 0) == 0 else 0) + (15 if repo.get("default_branch") else 0))
        rubric = [
            {"label": "Documentation", "score": documentation, "tip": "Add a strong README with setup, screenshots, usage and results." if not readme_present else "README found—make sure it explains the problem and measurable result."},
            {"label": "Code health", "score": code_quality, "tip": "Include a clear stack, runnable setup and focused source structure."},
            {"label": "Portfolio clarity", "score": portfolio, "tip": "Add topics, a project demo/homepage, and a license where appropriate."},
            {"label": "Maintenance", "score": maintenance, "tip": "Keep the default branch active and document known limitations."},
        ]
        total = round(sum(item["score"] for item in rubric) / len(rubric))
        return {"repository": {"fullName": repo.get("full_name"), "description": repo.get("description") or "No description provided.", "language": repo.get("language") or "Not specified", "stars": repo.get("stargazers_count", 0), "forks": repo.get("forks_count", 0), "updatedAt": repo.get("updated_at"), "readmePresent": readme_present}, "rubric": rubric, "portfolioScore": total}
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="GitHub took too long to respond. Please retry.")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not connect to GitHub.")


@app.get("/api/jobs")
async def live_engineering_jobs(query: str = "engineering", limit: int = 12):
    """Return a live public engineering-job feed; the client never sees provider credentials."""
    safe_limit = max(1, min(limit, 24))
    try:
        async with httpx.AsyncClient(timeout=18.0, follow_redirects=True) as client:
            response = await client.get("https://remotive.com/api/remote-jobs", params={"search": query[:80]})
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail="The live job provider is temporarily unavailable.")
        jobs = []
        for job in response.json().get("jobs", [])[:safe_limit]:
            jobs.append({"id": str(job.get("id")), "title": job.get("title", "Engineering role"), "company": job.get("company_name", "Company not listed"), "location": job.get("candidate_required_location", "Remote"), "category": job.get("category", "Engineering"), "url": job.get("url"), "publishedAt": job.get("publication_date")})
        return {"source": "Remotive", "query": query, "jobs": jobs, "live": True}
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="The live job provider took too long to respond.")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not connect to the live job provider.")


@app.post("/api/learner/daily-challenges/complete")
def complete_daily_challenge(request: DailyChallengeRequest, user: dict = Depends(require_user)):
    """Persist a learner's daily XP and streak in the server-side Firebase database."""
    challenge_id = request.challenge_id.strip()
    if not re.fullmatch(r"[a-z0-9-]{3,80}", challenge_id):
        raise HTTPException(status_code=400, detail="Invalid challenge identifier.")
    database = platform_database()
    uid = user.get("uid")
    today = datetime.now(timezone.utc).date().isoformat()
    daily_ref = database.collection("users").document(uid).collection("dailyChallenges").document(today)
    previous = daily_ref.get().to_dict() or {}
    completed = list(previous.get("completed", []))
    if challenge_id not in completed:
        completed.append(challenge_id)
    xp = len(completed) * 25
    daily_ref.set({"completed": completed, "xp": xp, "date": today, "updatedAt": _server_time()}, merge=True)
    user_ref = database.collection("users").document(uid)
    learner = user_ref.get().to_dict() or {}
    prior_date = learner.get("dailyChallengeDate")
    yesterday = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
    streak = int(learner.get("dailyChallengeStreak", 0))
    if prior_date != today:
        streak = streak + 1 if prior_date == yesterday else 1
    user_ref.set({"dailyChallengeXp": xp, "dailyChallengeDate": today, "dailyChallengeStreak": streak, "lastActiveAt": _server_time()}, merge=True)
    return {"date": today, "completed": completed, "xp": xp, "streak": streak, "persisted": True}


def _published_catalog(paths: list[dict]) -> list[dict]:
    """Hide draft content from public learners while retaining legacy content."""
    visible: list[dict] = []
    for raw_path in paths:
        if raw_path.get("status", "published") != "published":
            continue
        path = {**raw_path, "modules": []}
        for raw_module in raw_path.get("modules", []):
            if raw_module.get("status", "published") != "published":
                continue
            path["modules"].append({
                **raw_module,
                "lessons": [lesson for lesson in raw_module.get("lessons", []) if lesson.get("status", "published") == "published"],
            })
        visible.append(path)
    return visible


@app.get("/api/paths")
@app.get("/paths")
def get_all_paths():
    paths = []
    for path in _published_catalog(list(CATALOG.all_paths().values())):
        paths.append({
            "id": path["id"],
            "title": path["title"],
            "description": path["description"],
            "icon": path["icon"],
            "color": path["color"],
            "skills": path["skills"],
            "duration": path["duration"],
            "moduleCount": len(path["modules"]),
            "lessonCount": sum(len(m["lessons"]) for m in path["modules"]),
        })
    return {"paths": paths}


@app.get("/api/catalog")
@app.get("/catalog")
def get_public_catalog():
    """Return complete learning content without exposing admin operations."""
    return {"paths": _published_catalog(list(CATALOG.all_paths().values()))}


@app.get("/api/paths/{path_id}")
@app.get("/paths/{path_id}")
def get_path(path_id: str):
    path = CATALOG.get_path(path_id)
    if path is None or path.get("status", "published") != "published":
        raise HTTPException(status_code=404, detail="Learning path not found")
    published = _published_catalog([path])
    return published[0] if published else {**path, "modules": []}


@app.get("/api/paths/{path_id}/modules/{module_id}/lessons/{lesson_id}")
@app.get("/paths/{path_id}/modules/{module_id}/lessons/{lesson_id}")
def get_lesson(path_id: str, module_id: str, lesson_id: str):
    path = CATALOG.get_path(path_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Path not found")
    if path.get("status", "published") != "published":
        raise HTTPException(status_code=404, detail="Path not found")
    for module in path["modules"]:
        if module.get("status", "published") != "published":
            continue
        if module["id"] == module_id:
            for lesson in module["lessons"]:
                if lesson["id"] == lesson_id and lesson.get("status", "published") == "published":
                    return {"lesson": lesson, "path": path["title"], "module": module["title"]}
    raise HTTPException(status_code=404, detail="Lesson not found")


@app.get("/api/search")
@app.get("/search")
def search(q: str = ""):
    if not q:
        return {"results": []}
    q_lower = q.lower()
    results = []
    for path in _published_catalog(list(CATALOG.all_paths().values())):
        if q_lower in path["title"].lower() or q_lower in path["description"].lower():
            results.append({"type": "path", "id": path["id"], "title": path["title"], "description": path["description"]})
        for module in path["modules"]:
            for lesson in module["lessons"]:
                if q_lower in lesson["title"].lower():
                    results.append({
                        "type": "lesson",
                        "id": lesson["id"],
                        "title": lesson["title"],
                        "path": path["title"],
                        "pathId": path["id"],
                        "moduleId": module["id"],
                    })
        for resource in path.get("resources", []):
            if q_lower in resource["title"].lower():
                results.append({"type": "resource", "title": resource["title"], "url": resource["url"], "path": path["title"]})
    return {"results": results[:20]}


class LessonCreate(BaseModel):
    title: str
    type: str = "video"
    videoId: str = ""
    externalUrl: str = ""
    duration: str = "30 min"
    status: str = "published"


class PathUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    skills: list[str] | None = None
    duration: str | None = None
    status: str | None = None


class ModuleUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None


class LessonUpdate(BaseModel):
    title: str | None = None
    type: str | None = None
    videoId: str | None = None
    externalUrl: str | None = None
    audioUrl: str | None = None
    duration: str | None = None
    status: str | None = None


class UserRoleUpdate(BaseModel):
    role: str


class AnnouncementCreate(BaseModel):
    title: str
    message: str
    audience: str = "all"
    published: bool = False
    expiresAt: datetime | None = None


class ReportCreate(BaseModel):
    resourceUrl: str
    issueType: str
    details: str = ""


class ReportStatusUpdate(BaseModel):
    status: str
    resolutionNote: str = ""


class TelemetryEvent(BaseModel):
    eventType: str
    route: str = ""
    message: str = ""
    metadata: dict[str, str | int | float | bool] = {}


def _as_public_document(snapshot) -> dict:
    record = snapshot.to_dict() or {}
    record["id"] = snapshot.id
    for key, value in list(record.items()):
        parsed = _timestamp_to_datetime(value)
        if parsed:
            record[key] = parsed.isoformat()
    return record


@app.get("/api/announcements")
@app.get("/announcements")
def public_announcements():
    """Only currently-published announcements are available to learners."""
    database = getattr(CATALOG, "_db", None)
    if database is None:
        return {"available": False, "announcements": []}
    now = datetime.now(timezone.utc)
    records = []
    for snapshot in database.collection("announcements").stream():
        item = _as_public_document(snapshot)
        expires_at = _timestamp_to_datetime((snapshot.to_dict() or {}).get("expiresAt"))
        if item.get("published") and (expires_at is None or expires_at > now):
            records.append(item)
    records.sort(key=lambda item: item.get("publishedAt") or item.get("createdAt") or "", reverse=True)
    return {"available": True, "announcements": records[:20]}


@app.post("/api/reports", status_code=201)
@app.post("/reports", status_code=201)
def submit_report(report: ReportCreate, user: dict = Depends(require_user)):
    if report.issueType not in {"broken_video", "outdated_content", "incorrect_information", "other"}:
        raise HTTPException(status_code=422, detail="Unsupported report issue type")
    if not report.resourceUrl.startswith(("https://", "http://", "/")):
        raise HTTPException(status_code=422, detail="A valid resource URL is required")
    database = platform_database()
    entry = {
        "createdBy": user["uid"], "createdAt": _server_time(), "status": "open",
        "resourceUrl": report.resourceUrl[:2000], "issueType": report.issueType,
        "details": report.details[:2000],
    }
    _, reference = database.collection("reports").add(entry)
    return {"id": reference.id, "status": "open"}


@app.post("/api/telemetry", status_code=202)
@app.post("/telemetry", status_code=202)
def capture_telemetry(event: TelemetryEvent):
    """Accept privacy-minimised operational signals; never collect auth tokens or stacks."""
    if event.eventType not in {"page_view", "client_error", "api_error", "performance"}:
        raise HTTPException(status_code=422, detail="Unsupported telemetry event type")
    database = getattr(CATALOG, "_db", None)
    if database is None:
        return {"accepted": False, "reason": "Analytics storage is not connected"}
    database.collection("telemetryEvents").add({
        "eventType": event.eventType,
        "route": event.route[:300],
        "message": event.message[:500],
        "metadata": event.metadata,
        "createdAt": _server_time(),
    })
    return {"accepted": True}


@app.get("/api/admin/overview")
@app.get("/admin/overview")
def admin_overview(_admin: dict = Depends(require_admin)):
    paths = list(CATALOG.all_paths().values())
    return {
        "pathCount": len(paths),
        "moduleCount": sum(len(path["modules"]) for path in paths),
        "lessonCount": sum(len(module["lessons"]) for path in paths for module in path["modules"]),
        "storage": CATALOG.storage_mode,
        "paths": paths,
        "learnerAnalytics": learner_directory(),
    }


@app.get("/api/admin/users")
@app.get("/admin/users")
def admin_users(_admin: dict = Depends(require_admin)):
    """Administrator-only learner count and recent activity directory."""
    return learner_directory()


@app.patch("/api/admin/users/{uid}/role")
@app.patch("/admin/users/{uid}/role")
def update_user_role(uid: str, update: UserRoleUpdate, admin: dict = Depends(require_admin)):
    """Assign the only supported platform roles using trusted Firebase claims."""
    role = update.role.strip().lower()
    if role not in {"learner", "admin"}:
        raise HTTPException(status_code=422, detail="Role must be learner or admin")
    if uid == admin.get("uid") and role != "admin":
        raise HTTPException(status_code=400, detail="You cannot remove your own administrator access")
    if not (os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip() or os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()):
        raise HTTPException(status_code=503, detail="Role assignment needs Firebase server credentials. Configure FIREBASE_SERVICE_ACCOUNT_JSON before using it.")
    try:
        _ensure_firebase_admin()
        firebase_auth.set_custom_user_claims(uid, {"admin": role == "admin"})
        database = getattr(CATALOG, "_db", None)
        if database is not None:
            database.collection("users").document(uid).set({"role": role, "roleUpdatedAt": datetime.now(timezone.utc)}, merge=True)
        return {"uid": uid, "role": role}
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Could not update administrator role")
        raise HTTPException(status_code=502, detail=f"Could not update role: {type(error).__name__}")


def _catalog_http_error(error: Exception) -> HTTPException:
    if isinstance(error, ValueError):
        return HTTPException(status_code=422, detail=str(error))
    details = {"path": "Path not found", "module": "Module not found", "lesson": "Lesson not found"}
    return HTTPException(status_code=404, detail=details.get(error.args[0] if error.args else "", "Catalog item not found"))


def _validate_content_status(payload: dict) -> dict:
    status = payload.get("status")
    if status is not None:
        normalized = str(status).strip().lower()
        if normalized not in {"draft", "published"}:
            raise HTTPException(status_code=422, detail="Content status must be draft or published")
        payload["status"] = normalized
    return payload


@app.patch("/api/admin/paths/{path_id}")
@app.patch("/admin/paths/{path_id}")
def update_path(path_id: str, update: PathUpdate, _admin: dict = Depends(require_admin)):
    try:
        return CATALOG.update_path(path_id, _validate_content_status(update.model_dump(exclude_none=True)))
    except (KeyError, ValueError) as error:
        raise _catalog_http_error(error)


@app.patch("/api/admin/paths/{path_id}/modules/{module_id}")
@app.patch("/admin/paths/{path_id}/modules/{module_id}")
def update_module(path_id: str, module_id: str, update: ModuleUpdate, _admin: dict = Depends(require_admin)):
    try:
        return CATALOG.update_module(path_id, module_id, _validate_content_status(update.model_dump(exclude_none=True)))
    except (KeyError, ValueError) as error:
        raise _catalog_http_error(error)


@app.patch("/api/admin/paths/{path_id}/modules/{module_id}/lessons/{lesson_id}")
@app.patch("/admin/paths/{path_id}/modules/{module_id}/lessons/{lesson_id}")
def update_lesson(path_id: str, module_id: str, lesson_id: str, update: LessonUpdate, _admin: dict = Depends(require_admin)):
    try:
        return CATALOG.update_lesson(path_id, module_id, lesson_id, _validate_content_status(update.model_dump(exclude_none=True)))
    except (KeyError, ValueError) as error:
        raise _catalog_http_error(error)


@app.get("/api/admin/announcements")
@app.get("/admin/announcements")
def admin_announcements(_admin: dict = Depends(require_admin)):
    database = platform_database()
    items = [_as_public_document(snapshot) for snapshot in database.collection("announcements").stream()]
    items.sort(key=lambda item: item.get("createdAt") or "", reverse=True)
    return {"announcements": items[:100]}


@app.post("/api/admin/announcements", status_code=201)
@app.post("/admin/announcements", status_code=201)
def create_announcement(announcement: AnnouncementCreate, admin: dict = Depends(require_admin)):
    title, message = announcement.title.strip(), announcement.message.strip()
    if not title or not message:
        raise HTTPException(status_code=422, detail="Announcement title and message are required")
    if announcement.audience not in {"all", "learners", "admins"}:
        raise HTTPException(status_code=422, detail="Unsupported announcement audience")
    database = platform_database()
    entry = {
        "title": title[:160], "message": message[:4000], "audience": announcement.audience,
        "published": announcement.published, "createdAt": _server_time(),
        "createdBy": admin.get("uid"), "expiresAt": announcement.expiresAt,
    }
    if announcement.published:
        entry["publishedAt"] = _server_time()
    _, reference = database.collection("announcements").add(entry)
    audit_action(database, admin, "announcement.created", reference.id, {"published": announcement.published})
    return {"id": reference.id, "published": announcement.published}


@app.patch("/api/admin/announcements/{announcement_id}")
@app.patch("/admin/announcements/{announcement_id}")
def update_announcement(announcement_id: str, announcement: AnnouncementCreate, admin: dict = Depends(require_admin)):
    database = platform_database()
    reference = database.collection("announcements").document(announcement_id)
    if not reference.get().exists:
        raise HTTPException(status_code=404, detail="Announcement not found")
    update = {
        "title": announcement.title.strip()[:160], "message": announcement.message.strip()[:4000],
        "audience": announcement.audience, "published": announcement.published,
        "expiresAt": announcement.expiresAt, "updatedAt": _server_time(),
    }
    if not update["title"] or not update["message"]:
        raise HTTPException(status_code=422, detail="Announcement title and message are required")
    if announcement.published:
        update["publishedAt"] = _server_time()
    reference.update(update)
    audit_action(database, admin, "announcement.updated", announcement_id, {"published": announcement.published})
    return {"id": announcement_id, "updated": True}


@app.get("/api/admin/reports")
@app.get("/admin/reports")
def admin_reports(_admin: dict = Depends(require_admin)):
    database = platform_database()
    reports = [_as_public_document(snapshot) for snapshot in database.collection("reports").stream()]
    reports.sort(key=lambda item: item.get("createdAt") or "", reverse=True)
    return {"reports": reports[:200]}


@app.patch("/api/admin/reports/{report_id}")
@app.patch("/admin/reports/{report_id}")
def update_report_status(report_id: str, update: ReportStatusUpdate, admin: dict = Depends(require_admin)):
    if update.status not in {"open", "in_review", "resolved", "dismissed"}:
        raise HTTPException(status_code=422, detail="Unsupported report status")
    database = platform_database()
    reference = database.collection("reports").document(report_id)
    if not reference.get().exists:
        raise HTTPException(status_code=404, detail="Report not found")
    values = {"status": update.status, "updatedAt": _server_time(), "updatedBy": admin.get("uid"), "resolutionNote": update.resolutionNote[:2000]}
    if update.status in {"resolved", "dismissed"}:
        values["resolvedAt"] = _server_time()
        values["resolvedBy"] = admin.get("uid")
    reference.update(values)
    audit_action(database, admin, "report.status_updated", report_id, {"status": update.status})
    return {"id": report_id, "status": update.status}


@app.get("/api/admin/audit-log")
@app.get("/admin/audit-log")
def admin_audit_log(limit: int = 100, _admin: dict = Depends(require_admin)):
    database = platform_database()
    events = [_as_public_document(snapshot) for snapshot in database.collection("auditLogs").stream()]
    events.sort(key=lambda item: item.get("createdAt") or "", reverse=True)
    return {"events": events[:max(1, min(limit, 200))]}


@app.get("/api/admin/analytics")
@app.get("/admin/analytics")
def admin_analytics(_admin: dict = Depends(require_admin)):
    database = platform_database()
    since = datetime.now(timezone.utc) - timedelta(days=7)
    counts: dict[str, int] = {"page_view": 0, "client_error": 0, "api_error": 0, "performance": 0}
    for snapshot in database.collection("telemetryEvents").stream():
        record = snapshot.to_dict() or {}
        created_at = _timestamp_to_datetime(record.get("createdAt"))
        event_type = record.get("eventType")
        if created_at and created_at >= since and event_type in counts:
            counts[event_type] += 1
    return {"windowDays": 7, "events": counts, "errorCount": counts["client_error"] + counts["api_error"]}


@app.post("/api/admin/uploads", status_code=201)
@app.post("/admin/uploads", status_code=201)
async def upload_admin_asset(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    """Store administrator image/document assets in the configured Firebase Storage bucket."""
    if file.content_type not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(status_code=415, detail="Only JPG, PNG, WebP, GIF, PDF, and DOCX files are allowed")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if not content or len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Files must be between 1 byte and 10 MB")
    bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET", "").strip()
    if not bucket_name:
        raise HTTPException(status_code=503, detail="Set FIREBASE_STORAGE_BUCKET before uploading assets")
    try:
        _ensure_firebase_admin()
        from firebase_admin import storage
        from uuid import uuid4
        safe_name = os.path.basename(file.filename or "upload")[:120]
        object_name = f"admin-uploads/{datetime.now(timezone.utc):%Y/%m}/{uuid4().hex}-{safe_name}"
        blob = storage.bucket(bucket_name).blob(object_name)
        blob.upload_from_string(content, content_type=file.content_type)
        database = platform_database()
        _, reference = database.collection("uploads").add({
            "objectName": object_name, "originalName": safe_name, "contentType": file.content_type,
            "size": len(content), "uploadedBy": admin.get("uid"), "createdAt": _server_time(),
        })
        audit_action(database, admin, "asset.uploaded", reference.id, {"contentType": file.content_type, "size": len(content)})
        return {"id": reference.id, "objectName": object_name, "contentType": file.content_type, "size": len(content)}
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Admin asset upload failed")
        raise HTTPException(status_code=503, detail=f"Asset upload is unavailable: {type(error).__name__}")


@app.post("/api/admin/paths/{path_id}/modules/{module_id}/lessons", status_code=201)
@app.post("/admin/paths/{path_id}/modules/{module_id}/lessons", status_code=201)
def create_lesson(path_id: str, module_id: str, lesson: LessonCreate, _admin: dict = Depends(require_admin)):
    try:
        created = CATALOG.create_lesson(path_id, module_id, _validate_content_status(lesson.model_dump()))
        database = getattr(CATALOG, "_db", None)
        if database is not None:
            audit_action(database, _admin, "lesson.created", created["id"], {"pathId": path_id, "moduleId": module_id})
        return created
    except KeyError as error:
        if error.args[0] == "path":
            raise HTTPException(status_code=404, detail="Path not found")
        raise HTTPException(status_code=404, detail="Module not found")


@app.delete("/api/admin/paths/{path_id}/modules/{module_id}/lessons/{lesson_id}")
@app.delete("/admin/paths/{path_id}/modules/{module_id}/lessons/{lesson_id}")
def delete_lesson(path_id: str, module_id: str, lesson_id: str, _admin: dict = Depends(require_admin)):
    try:
        CATALOG.delete_lesson(path_id, module_id, lesson_id)
    except KeyError as error:
        details = {"path": "Path not found", "module": "Module not found", "lesson": "Lesson not found"}
        raise HTTPException(status_code=404, detail=details[error.args[0]])
    database = getattr(CATALOG, "_db", None)
    if database is not None:
        audit_action(database, _admin, "lesson.deleted", lesson_id, {"pathId": path_id, "moduleId": module_id})
    return {"deleted": lesson_id}
