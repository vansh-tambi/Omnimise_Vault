from fastapi import APIRouter, Depends, HTTPException
from typing import List
from models.user import UserResponse
from models.request import RequestCreate, RequestResponse, RequestInDB
from routes.auth import get_current_user
from database.mongodb import get_database
from bson import ObjectId

router = APIRouter(prefix="/requests", tags=["requests"])

@router.post("/create", response_model=RequestResponse)
async def create_request(req: RequestCreate, current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    req_dict = req.model_dump()
    req_db = RequestInDB(**req_dict, requester_id=current_user.id)
    
    req_db_dict = req_db.model_dump(by_alias=True, exclude_none=True)
    if "_id" in req_db_dict:
        del req_db_dict["_id"]
        
    result = await db.requests.insert_one(req_db_dict)
    req_db.id = str(result.inserted_id)
    return req_db

@router.get("", response_model=List[RequestResponse])
async def list_requests(current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    cursor = db.requests.find({"$or": [{"requester_id": current_user.id}, {"target_user_id": current_user.id}]})
    reqs = []
    async for document in cursor:
        document["_id"] = str(document["_id"])
        reqs.append(RequestInDB(**document))
    return reqs

from pydantic import BaseModel
class RespondRequest(BaseModel):
    request_id: str
    status: str # "approved" or "rejected"

@router.post("/respond")
async def respond_to_request(res: RespondRequest, current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    try:
        query = {"_id": ObjectId(res.request_id)}
    except:
        query = {"_id": res.request_id}
        
    req = await db.requests.find_one(query)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
        
    if req["target_user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to respond")
        
    await db.requests.update_one(query, {"$set": {"status": res.status}})
    
    if res.status == "approved":
        # automatically create access
        from models.access import AccessInDB
        acc = AccessInDB(
            vault_id=req["vault_id"],
            user_id=req["requester_id"],
            granted_by=current_user.id
        )
        acc_dict = acc.model_dump(by_alias=True, exclude_none=True)
        if "_id" in acc_dict:
            del acc_dict["_id"]
        await db.access.insert_one(acc_dict)
        
    return {"message": f"Request {res.status}"}
