import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import PyMongoError

MONGODB_URL = os.getenv("MONGO_URI") or os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "document_vault")
LOCAL_FALLBACK_URL = "mongodb://localhost:27017"
MONGO_TLS_DISABLE_OCSP = os.getenv("MONGO_TLS_DISABLE_OCSP", "true").lower() == "true"
MONGO_TLS_INSECURE = os.getenv("MONGO_TLS_INSECURE", "false").lower() == "true"


def _build_client(uri: str) -> AsyncIOMotorClient:
    options = {
        "serverSelectionTimeoutMS": 10000,
        "connectTimeoutMS": 10000,
        "socketTimeoutMS": 10000,
    }

    if uri.startswith("mongodb+srv://") or uri.startswith("mongodb://"):
        options["tls"] = True
        options["tlsCAFile"] = certifi.where()
        if MONGO_TLS_INSECURE:
            options["tlsAllowInvalidCertificates"] = True
            options["tlsAllowInvalidHostnames"] = True
        elif MONGO_TLS_DISABLE_OCSP:
            options["tlsDisableOCSPEndpointCheck"] = True

    return AsyncIOMotorClient(uri, **options)

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None
    audit_logs_collection = None
    notifications_collection = None

db_config = MongoDB()

async def connect_to_mongo():
    primary_error = None
    fallback_error = None

    try:
        db_config.client = _build_client(MONGODB_URL)
        await db_config.client.admin.command("ping")
        print(f"Connected to MongoDB via primary URI: {MONGODB_URL}")
    except PyMongoError as exc:
        primary_error = exc
        print(f"Primary MongoDB connection failed: {exc}")

    if db_config.client is None or primary_error is not None:
        if MONGODB_URL != LOCAL_FALLBACK_URL:
            try:
                db_config.client = _build_client(LOCAL_FALLBACK_URL)
                await db_config.client.admin.command("ping")
                print(f"Connected to MongoDB fallback URI: {LOCAL_FALLBACK_URL}")
                primary_error = None
            except PyMongoError as fallback_exc:
                fallback_error = fallback_exc

    if db_config.client is None or primary_error is not None:
        raise RuntimeError(
            "Unable to connect to MongoDB. "
            f"Primary error: {primary_error}. "
            f"Fallback error: {fallback_error}"
        )

    db_config.db = db_config.client[DATABASE_NAME]
    db_config.audit_logs_collection = db_config.db["audit_logs"]
    db_config.notifications_collection = db_config.db["notifications"]

async def close_mongo_connection():
    if db_config.client:
        db_config.client.close()
        print("Closed MongoDB connection")

def get_database():
    return db_config.db
