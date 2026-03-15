from datetime import datetime
from fastapi import Request

async def log_action(db, user_id: str, action: str, request: Request, document_id: str = None):
    ip_address = request.client.host if request.client else "unknown"
    audit_entry = {
        "user_id": user_id,
        "action": action,
        "document_id": document_id,
        "ip_address": ip_address,
        "timestamp": datetime.utcnow()
    }
    await db["audit_logs"].insert_one(audit_entry)
