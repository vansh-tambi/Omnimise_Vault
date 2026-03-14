import os
import uuid
from datetime import timedelta
from google.cloud import storage

# In product environment, assure you set GOOGLE_APPLICATION_CREDENTIALS 
# or use service account json passing
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "vault-storage")

def get_gcs_client():
    # Will automatically use GOOGLE_APPLICATION_CREDENTIALS env var
    return storage.Client()

async def upload_document(file_content: bytes, user_id: str, filename: str) -> str:
    client = get_gcs_client()
    bucket = client.bucket(GCS_BUCKET_NAME)
    
    unique_name = f"{user_id}/{uuid.uuid4()}-{filename}.enc"
    blob = bucket.blob(unique_name)
    
    # Upload binary file bytes directly
    blob.upload_from_string(file_content)
    
    # Return JUST the unique path to store in MongoDB
    return unique_name

def generate_signed_url(blob_name: str, expiry_minutes: int = 15) -> str:
    client = get_gcs_client()
    bucket = client.bucket(GCS_BUCKET_NAME)
    blob = bucket.blob(blob_name)
    
    # Create the temporary V4 signed URL
    return blob.generate_signed_url(
        expiration=timedelta(minutes=expiry_minutes), 
        version="v4"
    )
