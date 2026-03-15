from fastapi import APIRouter, Depends, HTTPException
from typing import List
from models.user import UserResponse
from models.request import RequestCreate, RequestResponse, RequestInDB
from routes.auth import get_current_user
from database.mongodb import get_database
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/requests", tags=["requests"])


@router.post("/create", response_model=RequestResponse)
async def create_request(req: RequestCreate, current_user: UserResponse = Depends(get_current_user)):
    db = get_database()

    # Resolve target user by email
    target_user = await db.users.find_one({"email": req.target_user_email})
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found with that email")

    target_user_id = str(target_user["_id"])

    req_dict = {
        "requester_id": current_user.id,
        "target_user_id": target_user_id,
        "target_user_email": req.target_user_email,
        "document_type": req.document_type,
        "status": "pending",
        "created_at": datetime.utcnow(),
    }

    result = await db.requests.insert_one(req_dict)
    req_dict["_id"] = str(result.inserted_id)
    return RequestInDB(**req_dict)


@router.get("", response_model=List[RequestResponse])
async def list_requests(current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    cursor = db.requests.find({
        "$or": [
            {"requester_id": current_user.id},
            {"target_user_id": current_user.id}
        ]
    }).sort("created_at", -1)
    reqs = []
    async for document in cursor:
        document["_id"] = str(document["_id"])
        reqs.append(RequestInDB(**document))
    return reqs


from pydantic import BaseModel

class RespondRequest(BaseModel):
    request_id: str
    action: str  # "approved" or "rejected"

@router.post("/respond")
async def respond_to_request(res: RespondRequest, current_user: UserResponse = Depends(get_current_user)):
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

    update_data = {
        "status": res.action,
        "responded_at": datetime.utcnow()
    }

    await db.requests.update_one(query, {"$set": update_data})
    req.update(update_data)
    req["_id"] = str(req["_id"])

    response_data = {"request": req}
    if res.action == "approved":
        # Return requester_id so frontend can open ShareDocument for that user
        requester = await db.users.find_one({"_id": ObjectId(req["requester_id"])})
        if requester:
            response_data["requester_email"] = requester.get("email", "")

    return response_data
