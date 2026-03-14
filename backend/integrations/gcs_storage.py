import os
import uuid
from google.cloud import storage

# In product environment, assure you set GOOGLE_APPLICATION_CREDENTIALS 
# or use service account json passing
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "vault-storage")

def get_gcs_client():
    # Will automatically use GOOGLE_APPLICATION_CREDENTIALS env var
    return storage.Client()

async def upload_document(file_content: bytes, filename: str) -> str:
    client = get_gcs_client()
    bucket = client.bucket(GCS_BUCKET_NAME)
    
    unique_name = f"{uuid.uuid4()}-{filename}"
    blob = bucket.blob(unique_name)
    
    # Upload binary file bytes directly
    blob.upload_from_string(file_content)
    
    return blob.public_url
