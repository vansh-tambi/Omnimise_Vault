import random
from datetime import datetime
from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from database.mongodb import get_database
from models.notification import NotificationInDB
from models.request import RequestCreate, RequestInDB, RequestRespond, RequestResponse
from models.user import UserResponse
from models.vault import VaultCreate
from routes.auth import get_current_user
from services.user_lookup import resolve_user_by_email_or_id
from services.vault_service import create_vault, get_user_vaults

router = APIRouter(prefix="/requests", tags=["requests"])


def serialize_request(document: dict) -> RequestInDB:
    document["_id"] = str(document["_id"])
    return RequestInDB(**document)


async def insert_notification(db, payload: dict):
    notification = NotificationInDB(**payload).model_dump(by_alias=True, exclude={"id"}, exclude_none=True)
    await db.notifications.insert_one(notification)


@router.post("", response_model=RequestResponse)
@router.post("/create", response_model=RequestResponse)
async def create_request(req: RequestCreate, current_user: UserResponse = Depends(get_current_user)):
    db = get_database()

    target_user = await resolve_user_by_email_or_id(db, req.target_identifier)
    if not target_user:
        raise HTTPException(status_code=404, detail="No user found with that email or ID.")

    target_user_id = str(target_user["_id"])

    req_dict = {
        "requester_id": current_user.id,
        "requester_email": current_user.email,
        "target_user_id": target_user_id,
        "target_user_email": target_user.get("email"),
        "document_type": req.document_type,
        "description": req.description,
        "status": "pending",
        "created_at": datetime.utcnow(),
        "fulfilled_vault_id": None,
        "fulfilled_at": None,
    }

    result = await db.requests.insert_one(req_dict)
    new_request_id = str(result.inserted_id)

    await insert_notification(
        db,
        {
            "user_id": target_user_id,
            "type": "document_request",
            "message": f"{current_user.email} has requested a document: {req.document_type}",
            "request_id": new_request_id,
            "read": False,
            "created_at": datetime.utcnow(),
        },
    )

    req_dict["_id"] = new_request_id
    return RequestInDB(**req_dict)


@router.get("", response_model=List[RequestResponse])
async def list_requests(current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    cursor = db.requests.find(
        {
            "$or": [
                {"requester_id": current_user.id},
                {"target_user_id": current_user.id}
            ]
        }
    ).sort("created_at", -1)
    reqs = []
    async for document in cursor:
        reqs.append(serialize_request(document))
    return reqs


@router.post("/respond")
async def respond_to_request(res: RequestRespond, current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    try:
        query = {"_id": ObjectId(res.request_id)}
    except Exception:
        query = {"_id": res.request_id}

    req = await db.requests.find_one(query)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    if req.get("target_user_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Only the target user can respond to this request")

    if res.action not in {"approved", "rejected"}:
        raise HTTPException(status_code=400, detail="Action must be approved or rejected")

    if res.action == "rejected":
        await db.requests.update_one(
            query,
            {"$set": {"status": "rejected", "fulfilled_vault_id": None, "fulfilled_at": None}},
        )
        return {"status": "rejected", "message": "Request rejected"}

    requester_vaults = await get_user_vaults(req["requester_id"])
    selected_vault = requester_vaults[0] if requester_vaults else None
    generated_pin = None

    if not selected_vault:
        generated_pin = f"{random.randint(0, 999999):06d}"
        selected_vault = await create_vault(
            VaultCreate(
                name=f"Shared Vault - {req['document_type']}",
                requires_pin_setup=True,
                temp_pin=generated_pin,
            ),
            req["requester_id"],
        )

    fulfilled_at = datetime.utcnow()
    await db.requests.update_one(
        query,
        {
            "$set": {
                "status": "approved",
                "fulfilled_vault_id": selected_vault.id,
                "fulfilled_at": fulfilled_at,
            }
        },
    )

    if generated_pin:
        message = (
            f"Your request for {req['document_type']} was approved. A new vault has been created for you. "
            f"Your temporary vault PIN is: {generated_pin}. Please log in, open this vault, and change your PIN immediately."
        )
    else:
        message = (
            f"Your request for {req['document_type']} was approved. "
            "A vault is ready for you in your account."
        )

    await insert_notification(
        db,
        {
            "user_id": req["requester_id"],
            "type": "vault_created",
            "message": message,
            "request_id": str(req["_id"]),
            "read": False,
            "created_at": datetime.utcnow(),
            "data": {
                "vault_id": selected_vault.id,
                "temp_pin": generated_pin,
            },
        },
    )

    if generated_pin:
        return {
            "status": "approved",
            "vault_id": selected_vault.id,
            "temp_pin": generated_pin,
            "message": "Vault created and PIN sent to requester via notification",
        }

    return {
        "status": "approved",
        "vault_id": selected_vault.id,
        "temp_pin": None,
        "message": "Request approved and requester notified with vault access",
    }
