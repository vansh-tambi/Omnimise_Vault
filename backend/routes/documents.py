from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import List
from models.user import UserResponse
from models.document import DocumentResponse, DocumentCreate
from routes.auth import get_current_user
from services.vault_service import check_vault_access
from services.document_service import create_document, get_documents_by_vault, get_document_by_id
from integrations.gcs_storage import upload_document, generate_signed_url

router = APIRouter(prefix="/documents", tags=["documents"])

@router.post("/upload", response_model=DocumentResponse)
async def upload_file(
    vault_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user)
):
    has_access = await check_vault_access(vault_id, current_user.id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Not authorized to access this vault")
        
    file_bytes = await file.read()
    size_bytes = len(file_bytes)
    # Uploading just the path using the owner's ID
    storage_path = await upload_document(file_bytes, current_user.id, file.filename)
    
    doc_create = DocumentCreate(
        filename=file.filename,
        vault_id=vault_id,
        content_type=file.content_type,
        size_bytes=size_bytes,
        storage_url=storage_path
    )
    
    return await create_document(doc_create, current_user.id)

@router.get("", response_model=List[DocumentResponse])
async def list_documents(vault_id: str, current_user: UserResponse = Depends(get_current_user)):
    has_access = await check_vault_access(vault_id, current_user.id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Not authorized to access this vault")
        
    return await get_documents_by_vault(vault_id)

@router.get("/{id}")
async def get_document(id: str, current_user: UserResponse = Depends(get_current_user)):
    doc = await get_document_by_id(id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    has_access = await check_vault_access(doc.vault_id, current_user.id)
    if not has_access:
        # Check document-level access
        from database.mongodb import get_database
        from datetime import datetime
        db = get_database()
        
        access_record = await db.access.find_one({
            "document_id": doc.id,
            "shared_with": current_user.id
        })
        if access_record:
            expires_at = access_record.get("expires_at")
            if expires_at and expires_at <= datetime.utcnow():
                raise HTTPException(status_code=403, detail="Access has expired")
            has_access = True

    if not has_access:
        raise HTTPException(status_code=403, detail="Not authorized to access this document")
        
    # Generate the signed, timed URL since user is authorized
    temporary_url = generate_signed_url(doc.storage_url, expiry_minutes=15)
        
    # Return storage URL for downloading
    # If standard retrieval is used, the frontend directly downloads via URL
    return {
        "id": doc.id,
        "filename": doc.filename,
        "content_type": doc.content_type,
        "size_bytes": doc.size_bytes,
        "storage_url": temporary_url
    }
