from fastapi import APIRouter, Depends, HTTPException
from typing import List
from models.user import UserResponse
from models.message import MessageCreate, MessageResponse, MessageInDB
from routes.auth import get_current_user
from database.mongodb import get_database
from bson import ObjectId

router = APIRouter(prefix="/messages", tags=["messages"])


@router.post("/send", response_model=MessageResponse)
async def send_message(msg: MessageCreate, current_user: UserResponse = Depends(get_current_user)):
    db = get_database()

    # Verify receiver exists
    try:
        receiver = await db.users.find_one({"_id": ObjectId(msg.receiver_id)})
    except Exception:
        receiver = await db.users.find_one({"_id": msg.receiver_id})

    if not receiver:
        raise HTTPException(status_code=404, detail="Recipient user not found")

    msg_dict = {
        "sender_id": current_user.id,
        "receiver_id": msg.receiver_id,
        "encrypted_message": msg.encrypted_message,
        "read": False,
        "read_at": None,
    }
    from datetime import datetime
    msg_dict["sent_at"] = datetime.utcnow()

    result = await db.messages.insert_one(msg_dict)
    msg_dict["id"] = str(result.inserted_id)
    return MessageResponse(**msg_dict)


@router.get("/inbox", response_model=List[MessageResponse])
async def get_inbox(current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    cursor = db.messages.find({"receiver_id": current_user.id}).sort("sent_at", -1)
    msgs = []
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        msgs.append(MessageResponse(**doc))
    return msgs


@router.get("/sent", response_model=List[MessageResponse])
async def get_sent(current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    cursor = db.messages.find({"sender_id": current_user.id}).sort("sent_at", -1)
    msgs = []
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        msgs.append(MessageResponse(**doc))
    return msgs


@router.post("/mark_read/{message_id}")
async def mark_read(message_id: str, current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    try:
        query = {"_id": ObjectId(message_id), "receiver_id": current_user.id}
    except Exception:
        query = {"_id": message_id, "receiver_id": current_user.id}

    from datetime import datetime
    result = await db.messages.update_one(query, {"$set": {"read": True, "read_at": datetime.utcnow()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Message not found or not authorized")
    return {"message": "Marked as read"}
