from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from database.mongodb import get_database
from models.notification import NotificationInDB, NotificationResponse
from models.user import UserResponse
from routes.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


def build_notification_response(document: dict, request_status: str | None = None) -> NotificationResponse:
    document["_id"] = str(document["_id"])
    notification = NotificationInDB(**document).model_dump()
    notification["request_status"] = request_status
    return NotificationResponse(**notification)


@router.get("", response_model=List[NotificationResponse])
async def list_notifications(current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    cursor = db.notifications.find({"user_id": current_user.id}).sort("created_at", -1)
    notifications = []
    async for document in cursor:
        request_status = None
        if document.get("request_id"):
            try:
                request = await db.requests.find_one({"_id": ObjectId(document["request_id"])})
            except Exception:
                request = await db.requests.find_one({"_id": document["request_id"]})
            if request:
                request_status = request.get("status")

        notifications.append(build_notification_response(document, request_status))
    return notifications


@router.post("/mark_read/{notification_id}")
async def mark_notification_read(notification_id: str, current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    try:
        query = {"_id": ObjectId(notification_id)}
    except Exception:
        query = {"_id": notification_id}

    notification = await db.notifications.find_one(query)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if notification.get("user_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this notification")

    await db.notifications.update_one(query, {"$set": {"read": True}})
    return {"message": "Notification marked as read"}


@router.get("/unread_count")
async def unread_notification_count(current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    count = await db.notifications.count_documents({"user_id": current_user.id, "read": False})
    return {"count": count}