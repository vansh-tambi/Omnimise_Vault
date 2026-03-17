import os
import uuid
import pathlib
from datetime import timedelta
from google.cloud import storage

# Environment toggle
GCS_ENABLED = os.getenv("GCS_ENABLED", "true").lower() == "true"

# In product environment, assure you set GOOGLE_APPLICATION_CREDENTIALS 
# or use service account json passing
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "vault-storage")
LOCAL_STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "local_storage")

def get_gcs_client():
    # Will automatically use GOOGLE_APPLICATION_CREDENTIALS env var
    return storage.Client()

def upload_file_local(user_id: str, filename: str, data: bytes) -> str:
    user_dir = os.path.join(LOCAL_STORAGE_DIR, user_id)
    os.makedirs(user_dir, exist_ok=True)
    
    unique_name = f"{uuid.uuid4()}-{filename}.enc"
    file_path = os.path.join(user_dir, unique_name)
    
    with open(file_path, "wb") as f:
        f.write(data)
        
    return f"{user_id}/{unique_name}"

def download_file_local(storage_url: str) -> bytes:
    file_path = os.path.join(LOCAL_STORAGE_DIR, storage_url)
    with open(file_path, "rb") as f:
        return f.read()

async def upload_document(file_content: bytes, user_id: str, filename: str) -> str:
    # Retain the exact existing name used in routes/documents.py for backward compatibility
    return await upload_encrypted_file(file_content, user_id, filename)

async def upload_encrypted_file(file_content: bytes, user_id: str, filename: str) -> str:
    if not GCS_ENABLED:
        # New fallback: store encrypted blobs in user's Google Drive instead of local disk.
        from integrations.google_drive import upload_encrypted_file_to_user_drive
        return await upload_encrypted_file_to_user_drive(user_id, filename, file_content)

    client = get_gcs_client()
    bucket = client.bucket(GCS_BUCKET_NAME)
    
    unique_name = f"{user_id}/{uuid.uuid4()}-{filename}.enc"
    blob = bucket.blob(unique_name)
    
    # Upload binary file bytes directly
    blob.upload_from_string(file_content)
    
    # Return JUST the unique path to store in MongoDB
    return unique_name

def download_encrypted_file(storage_url: str) -> bytes:
    if not GCS_ENABLED:
        return download_file_local(storage_url)
        
    client = get_gcs_client()
    bucket = client.bucket(GCS_BUCKET_NAME)
    blob = bucket.blob(storage_url)
    return blob.download_as_bytes()

def generate_signed_url(blob_path: str, expiry_minutes: int = 15) -> str:
    if not GCS_ENABLED:
        # For Drive-backed storage, documents are served through authenticated proxy routes.
        if str(blob_path).startswith("drive:"):
            return ""
        return f"http://localhost:8000/local-files/{blob_path}"

    client = get_gcs_client()
    bucket = client.bucket(GCS_BUCKET_NAME)
    blob = bucket.blob(blob_path)
    
    # Create the temporary V4 signed URL
    return blob.generate_signed_url(
        expiration=timedelta(minutes=expiry_minutes), 
        version="v4"
    )

def delete_file(storage_url: str):
    if not GCS_ENABLED:
        try:
            local_path = os.path.join(LOCAL_STORAGE_DIR, storage_url)
            if os.path.exists(local_path):
                os.remove(local_path)
            return True
        except Exception as e:
            print(f"Local delete error: {e}")
            return False
            
    try:
        client = get_gcs_client()
        bucket = client.bucket(GCS_BUCKET_NAME)
        blob = bucket.blob(storage_url)
        blob.delete()
        return True
    except Exception as e:
        print(f"GCS delete error: {e}")
        return False
