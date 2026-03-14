from fastapi import APIRouter, Depends, HTTPException
from typing import List
from models.user import UserResponse
from models.message import MessageCreate, MessageResponse, MessageInDB
from routes.auth import get_current_user
from database.mongodb import get_database

router = APIRouter(prefix="/messages", tags=["messages"])

@router.post("/send", response_model=MessageResponse)
async def send_message(msg: MessageCreate, current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    msg_db = MessageInDB(**msg.model_dump(), sender_id=current_user.id)
    
    msg_db_dict = msg_db.model_dump(by_alias=True, exclude_none=True)
    if "_id" in msg_db_dict:
        del msg_db_dict["_id"]
        
    result = await db.messages.insert_one(msg_db_dict)
    msg_db.id = str(result.inserted_id)
    return msg_db

@router.get("/inbox", response_model=List[MessageResponse])
async def get_inbox(current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    cursor = db.messages.find({"receiver_id": current_user.id})
    msgs = []
    async for document in cursor:
        document["_id"] = str(document["_id"])
        msgs.append(MessageInDB(**document))
    return msgs
