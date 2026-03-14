import os
import io
import zipfile
import asyncio
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from database.mongodb import get_database
from integrations.gcs_storage import get_gcs_client, GCS_BUCKET_NAME
from bson import ObjectId

SCOPES = ['https://www.googleapis.com/auth/drive.file']

def authenticate_drive():
    """Authenticate and return Google Drive API service using Service Account JSON"""
    creds = None
    # We map this similarly to GCS; relying on the env path or a local generic json
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "gcs_key.json")
    if os.path.exists(credentials_path):
        creds = service_account.Credentials.from_service_account_file(
            credentials_path, scopes=SCOPES)
    else:
        # For simplicity, if not found, we use default fallback
        import google.auth
        creds, _ = google.auth.default(scopes=SCOPES)
        
    return build('drive', 'v3', credentials=creds)

def create_backup_folder(service, user_id: str) -> str:
    """Create or find a folder named vault-backup-{user_id} in Google Drive."""
    folder_name = f"vault-backup-{user_id}"
    
    # Check if exists
    query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    response = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
    files = response.get('files', [])
    
    if files:
        return files[0].get('id')
        
    # Create new
    folder_metadata = {
        'name': folder_name,
        'mimeType': 'application/vnd.google-apps.folder'
    }
    folder = service.files().create(body=folder_metadata, fields='id').execute()
    return folder.get('id')

async def backup_user_vault(user_id: str):
    """
    Downloads each .enc blob from GCS into memory for the specified user, 
    zips them up natively inside RAM via io.BytesIO(), 
    and streams the resulting zip straight into Google Drive.
    """
    print(f"[{user_id}] Starting remote Google Drive backup process...")
    try:
        db = get_database()
        
        # We find all documents where the owner is user_id
        # Wait, documents are bound to vault_id. 
        # So we first find all vaults for the user.
        try:
            vaults = await db.vaults.find({"owner_id": user_id}).to_list(length=None)
        except Exception:
            # Fallback if find returns a cursor (motor behavior varies based on await)
            cursor = db.vaults.find({"owner_id": user_id})
            vaults = []
            async for v in cursor:
                vaults.append(v)
                
        if not vaults:
            print(f"[{user_id}] No vaults found.")
            return
            
        vault_ids = [str(v["_id"]) for v in vaults]
        
        cursor = db.documents.find({"vault_id": {"$in": vault_ids}})
        documents = []
        async for d in cursor:
            documents.append(d)
            
        if not documents:
            print(f"[{user_id}] No documents found to backup.")
            return
            
        # Spin up GCS
        gcs_client = get_gcs_client()
        bucket = gcs_client.bucket(GCS_BUCKET_NAME)
        
        # Prepare in-memory ZIP
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
            for doc in documents:
                storage_path = doc.get("storage_url")
                if not storage_path:
                    continue
                    
                blob = bucket.blob(storage_path)
                if not blob.exists():
                    continue
                    
                # Download into memory
                blob_bytes = blob.download_as_bytes()
                
                # We need to construct a unique, meaningful name inside the ZIP
                zip_filename = f"{doc.get('vault_id')}/{doc.get('filename')}.enc"
                
                # Write to zip
                zip_file.writestr(zip_filename, blob_bytes)
                
        zip_buffer.seek(0)
        
        # Step 2: Upload to Google Drive
        # Using synchronous Drive API call here since the SDK is sync
        service = authenticate_drive()
        folder_id = create_backup_folder(service, user_id)
        
        from datetime import datetime
        backup_filename = f"backup_{datetime.utcnow().strftime('%Y-%m-%d_%H-%M-%S')}.zip"
        
        file_metadata = {
            'name': backup_filename,
            'parents': [folder_id]
        }
        
        media = MediaIoBaseUpload(zip_buffer, mimetype='application/zip', resumable=True)
        
        print(f"[{user_id}] Triggering Drive Upload of {backup_filename}...")
        drive_file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
        
        print(f"[{user_id}] Backup complete. Drive File ID: {drive_file.get('id')}")
        
    except Exception as e:
        print(f"[{user_id}] Backup failed: {str(e)}")
