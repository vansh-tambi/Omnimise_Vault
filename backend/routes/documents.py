from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from typing import List
from models.user import UserResponse
from models.document import DocumentResponse, DocumentCreate
from routes.auth import get_current_user
from services.vault_service import check_vault_access
from services.document_service import create_document, get_documents_by_vault
from integrations.gcs_storage import upload_document, generate_signed_url
from services.audit_service import log_action
import os
from datetime import datetime
from fastapi.responses import JSONResponse
from fastapi.responses import StreamingResponse
import io

router = APIRouter(prefix="/documents", tags=["documents"])


async def _get_authorized_document(db, document_id: str, current_user: UserResponse):
    from bson import ObjectId

    try:
        document = await db.documents.find_one({"_id": ObjectId(document_id)})
    except Exception:
        document = await db.documents.find_one({"_id": document_id})

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    document_id_str = str(document["_id"])

    owner_access = False
    try:
        owner_access = await db.vaults.find_one({"_id": ObjectId(document["vault_id"]), "user_id": current_user.id}) is not None
    except Exception:
        owner_access = await db.vaults.find_one({"_id": document["vault_id"], "user_id": current_user.id}) is not None

    valid_access_record = await db.access.find_one(
        {
            "shared_with": current_user.id,
            "$or": [
                {"document_id": document_id_str},
                {"document_id": document_id}
            ]
        }
    )

    if valid_access_record:
        expires_at = valid_access_record.get("expires_at")
        if expires_at and expires_at <= datetime.utcnow():
            valid_access_record = None

    if not owner_access and not valid_access_record:
        raise HTTPException(status_code=403, detail="Not authorized to access this document")

    return document

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
    from database.mongodb import get_database
    db = get_database()

    # Step 1: fetch the document from MongoDB. If not found return 404.
    document = await _get_authorized_document(db, id, current_user)

    document_id_str = str(document["_id"])

    # Step 3: check self-destruct before incrementing view count.
    destruction_reason = await enforce_self_destruct(document, db)
    if destruction_reason is not None:
        return JSONResponse(status_code=410, content={"detail": destruction_reason, "destroyed": True})

    # Step 4: increment view_count atomically.
    await db.documents.update_one({"_id": document["_id"]}, {"$inc": {"view_count": 1}})

    # Step 5: re-fetch after increment.
    updated_document = await db.documents.find_one({"_id": document["_id"]})
    if not updated_document:
        return JSONResponse(status_code=410, content={"detail": "Document was removed.", "destroyed": True})

    # Step 6: check self-destruct by views again with updated count.
    if updated_document.get("self_destruct_after_views") is not None:
        if updated_document.get("view_count", 0) >= updated_document["self_destruct_after_views"]:
            await hard_delete_document(updated_document, db)
            return JSONResponse(
                status_code=410,
                content={
                    "detail": "Document has reached its maximum view limit.",
                    "destroyed": True,
                },
            )

    # Step 7: generate and return signed URL/local URL normally.
    storage_ref = updated_document.get("storage_url", "")
    if str(storage_ref).startswith("drive:"):
        temporary_url = f"/documents/{document_id_str}/download"
    else:
        temporary_url = generate_signed_url(storage_ref, expiry_minutes=15)
    
    await log_action(db, current_user.id, "file_downloaded", request, document_id=document_id_str)
        
    return {
        "id": document_id_str,
        "filename": updated_document["filename"],
        "content_type": updated_document["content_type"],
        "size_bytes": updated_document["size_bytes"],
        "storage_url": temporary_url
    }


@router.get("/{id}/download")
async def download_document_bytes(id: str, current_user: UserResponse = Depends(get_current_user)):
    """Authenticated proxy endpoint used for Drive-backed document blobs."""
    from database.mongodb import get_database
    db = get_database()

    document = await _get_authorized_document(db, id, current_user)
    storage_ref = document.get("storage_url", "")

    if not str(storage_ref).startswith("drive:"):
        raise HTTPException(status_code=400, detail="Direct download proxy is only used for Drive-backed files")

    from integrations.google_drive import download_drive_file_bytes

    try:
        file_bytes = await download_drive_file_bytes(storage_ref)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch file from Google Drive: {str(e)}")

    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type=document.get("content_type") or "application/octet-stream",
        headers={"Content-Disposition": f"inline; filename={document.get('filename', 'document.enc')}"},
    )

async def enforce_self_destruct(document, db):
    now = datetime.utcnow()
    should_destroy = False
    reason = ""

    if document.get("self_destruct_at") is not None:
        if now >= document["self_destruct_at"]:
            should_destroy = True
            reason = "Document has passed its auto-delete date."

    if document.get("self_destruct_after_views") is not None:
        if document.get("view_count", 0) >= document["self_destruct_after_views"]:
            should_destroy = True
            reason = "Document has reached its maximum view limit."

    if should_destroy:
        await hard_delete_document(document, db)
        return reason
    return None


async def hard_delete_document(document, db):
    storage_url = document.get("storage_url", "")
    document_id_raw = document["_id"]
    document_id_str = str(document["_id"])

    if str(storage_url).startswith("drive:"):
        try:
            from integrations.google_drive import delete_drive_file
            await delete_drive_file(storage_url)
        except Exception:
            pass
    elif os.getenv("GCS_ENABLED", "true").lower() == "true":
        try:
            from integrations.gcs_storage import get_gcs_client
            client = get_gcs_client()
            bucket_name = os.getenv("GCS_BUCKET_NAME")
            bucket = client.bucket(bucket_name)
            blob = bucket.blob(storage_url)
            blob.delete()
        except Exception:
            pass
    else:
        try:
            local_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "local_storage", storage_url)
            if os.path.exists(local_path):
                os.remove(local_path)
        except Exception:
            pass

    await db.access.delete_many({"$or": [{"document_id": document_id_str}, {"document_id": document_id_raw}]})

    await db.audit_logs.insert_one(
        {
            "user_id": document.get("owner_id", "system"),
            "action": "document_self_destructed",
            "document_id": document_id_str,
            "ip_address": "system",
            "timestamp": datetime.utcnow(),
        }
    )

    await db.audit_logs.delete_many({"$or": [{"document_id": document_id_str}, {"document_id": document_id_raw}]})
    await db.documents.delete_one({"_id": document_id_raw})


async def _delete_document_storage_and_records(document, db):
    storage_url = document.get("storage_url", "")
    document_id_raw = document["_id"]
    document_id_str = str(document["_id"])

    if str(storage_url).startswith("drive:"):
        try:
            from integrations.google_drive import delete_drive_file
            await delete_drive_file(storage_url)
        except Exception:
            pass
    elif os.getenv("GCS_ENABLED", "true").lower() == "true":
        try:
            from integrations.gcs_storage import get_gcs_client
            client = get_gcs_client()
            bucket_name = os.getenv("GCS_BUCKET_NAME")
            bucket = client.bucket(bucket_name)
            blob = bucket.blob(storage_url)
            blob.delete()
        except Exception:
            pass
    else:
        try:
            local_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "local_storage", storage_url)
            if os.path.exists(local_path):
                os.remove(local_path)
        except Exception:
            pass

    await db.documents.delete_one({"_id": document_id_raw})
    await db.access.delete_many({"$or": [{"document_id": document_id_str}, {"document_id": document_id_raw}]})

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
        
    await _delete_document_storage_and_records(db_doc, db)
    await log_action(db, current_user.id, "file_deleted", request, document_id=id)
    
    return {"message": "Document deleted successfully"}
