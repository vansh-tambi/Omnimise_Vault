from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from typing import List
from models.user import UserResponse
from models.document import DocumentResponse, DocumentCreate
from routes.auth import get_current_user
from services.vault_service import check_vault_access
from services.document_service import create_document, get_documents_by_vault, get_document_by_id
from integrations.gcs_storage import upload_document, generate_signed_url
from services.audit_service import log_action
import os

router = APIRouter(prefix="/documents", tags=["documents"])

@router.post("/upload", response_model=DocumentResponse)
async def upload_file(
    request: Request,
    vault_id: str = Form(...),
    file: UploadFile = File(...),
    file_hash: str = Form(None),
    self_destruct_after_views: int = Form(None),
    self_destruct_at: str = Form(None),
    current_user: UserResponse = Depends(get_current_user)
):
    has_access = await check_vault_access(vault_id, current_user.id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Not authorized to access this vault")
        
    # File Type Validation
    ALLOWED_EXTENSIONS = {"pdf", "docx", "doc", "png", "jpg", "jpeg", "zip", "txt"}
    filename_lower = file.filename.lower()
    if "." not in filename_lower:
        raise HTTPException(status_code=400, detail="File type not permitted. Allowed types: pdf, docx, png, jpg, jpeg, zip, txt")
        
    ext = filename_lower.rsplit(".", 1)[1]
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="File type not permitted. Allowed types: pdf, docx, png, jpg, jpeg, zip, txt")
        
    file_bytes = await file.read()
    size_bytes = len(file_bytes)
    storage_path = await upload_document(file_bytes, current_user.id, file.filename)
    
    # Parse self_destruct_at as datetime if provided
    parsed_self_destruct_at = None
    if self_destruct_at:
        from datetime import datetime
        try:
            parsed_self_destruct_at = datetime.fromisoformat(self_destruct_at.replace("Z", "+00:00"))
        except ValueError:
            parsed_self_destruct_at = None
    
    doc_create = DocumentCreate(
        filename=file.filename,
        vault_id=vault_id,
        content_type=file.content_type,
        size_bytes=size_bytes,
        storage_url=storage_path,
        file_hash=file_hash,
        self_destruct_after_views=self_destruct_after_views,
        self_destruct_at=parsed_self_destruct_at
    )
    
    created_doc = await create_document(doc_create, current_user.id)
    
    from database.mongodb import get_database
    db = get_database()
    await log_action(db, current_user.id, "file_uploaded", request, document_id=created_doc.id)
    
    return created_doc


@router.get("", response_model=List[DocumentResponse])
async def list_documents(vault_id: str, current_user: UserResponse = Depends(get_current_user)):
    has_access = await check_vault_access(vault_id, current_user.id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Not authorized to access this vault")
        
    return await get_documents_by_vault(vault_id)

@router.get("/{id}")
async def get_document(id: str, request: Request, current_user: UserResponse = Depends(get_current_user)):
    doc = await get_document_by_id(id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    from database.mongodb import get_database
    from datetime import datetime
    from bson import ObjectId
    db = get_database()
    
    # 1. Self Destruct At check (Owner or Shared)
    db_doc = await db.documents.find_one({"_id": ObjectId(id)})
    if db_doc and db_doc.get("self_destruct_at"):
        if datetime.utcnow() >= db_doc["self_destruct_at"]:
            await _hard_delete_document(db_doc, db)
            raise HTTPException(status_code=410, detail="This document has been permanently destroyed after reaching its view limit")

    has_access = await check_vault_access(doc.vault_id, current_user.id)
    
    if not has_access:
        # Check document-level access
        access_record = await db.access.find_one({
            "document_id": doc.id,
            "shared_with": current_user.id
        })
        if access_record:
            expires_at = access_record.get("expires_at")
            if expires_at and expires_at <= datetime.utcnow():
                raise HTTPException(status_code=403, detail="Access to this document has expired")
            
            # View Limits Check
            max_views = access_record.get("max_views")
            current_views = access_record.get("current_views", 0)
            if max_views is not None and current_views >= max_views:
                raise HTTPException(status_code=403, detail="Maximum view limit reached for this shared document")
            
            await db.access.update_one({"_id": access_record["_id"]}, {"$inc": {"current_views": 1}})
            has_access = True

    if not has_access:
        raise HTTPException(status_code=403, detail="Not authorized to access this document")
        
    # 2. View Count Self Destruct logic
    new_view_count = db_doc.get("view_count", 0) + 1
    await db.documents.update_one({"_id": ObjectId(id)}, {"$set": {"view_count": new_view_count}})
    
    self_destruct_after_views = db_doc.get("self_destruct_after_views")
    if self_destruct_after_views is not None and new_view_count >= self_destruct_after_views:
        await _hard_delete_document(db_doc, db)
        raise HTTPException(status_code=410, detail="This document has been permanently destroyed after reaching its view limit")

    # Generate the signed, timed URL since user is authorized
    temporary_url = generate_signed_url(doc.storage_url, expiry_minutes=15)
    
    await log_action(db, current_user.id, "file_downloaded", request, document_id=doc.id)
        
    # Return storage URL for downloading
    # If standard retrieval is used, the frontend directly downloads via URL
    return {
        "id": doc.id,
        "filename": doc.filename,
        "content_type": doc.content_type,
        "size_bytes": doc.size_bytes,
        "storage_url": temporary_url
    }

async def _hard_delete_document(db_doc, db):
    from bson import ObjectId
    # Try deleting from GCS or Local
    storage_url = db_doc.get("storage_url", "")
    if os.getenv("GCS_ENABLED", "true").lower() == "true":
        try:
            from integrations.gcs_storage import get_gcs_client
            client = get_gcs_client()
            bucket_name = os.getenv("GCS_BUCKET_NAME")
            bucket = client.bucket(bucket_name)
            blob = bucket.blob(storage_url)
            blob.delete()
        except:
            pass
    else:
        try:
            local_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), storage_url)
            if os.path.exists(local_path):
                os.remove(local_path)
        except:
            pass
            
    # Delete metadata
    await db.documents.delete_one({"_id": db_doc["_id"]})
    await db.access.delete_many({"document_id": str(db_doc["_id"])})

@router.delete("/{id}")
async def delete_document(id: str, request: Request, current_user: UserResponse = Depends(get_current_user)):
    from database.mongodb import get_database
    from bson import ObjectId
    db = get_database()
    
    db_doc = await db.documents.find_one({"_id": ObjectId(id)})
    if not db_doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # User must own the vault to delete the doc
    has_access = await check_vault_access(db_doc["vault_id"], current_user.id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Not authorized to delete this document")
        
    await _hard_delete_document(db_doc, db)
    await log_action(db, current_user.id, "file_deleted", request, document_id=id)
    
    return {"message": "Document deleted successfully"}
