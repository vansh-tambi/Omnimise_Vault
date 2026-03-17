import os
import io
import zipfile
import asyncio
from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleAuthRequest
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from database.mongodb import get_database
from integrations.gcs_storage import get_gcs_client, GCS_BUCKET_NAME
from bson import ObjectId

SCOPES = ['https://www.googleapis.com/auth/drive.file']
TOKEN_URI = "https://oauth2.googleapis.com/token"

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

def authenticate_drive_for_user(user: dict):
    access_token = user.get("google_drive_access_token")
    refresh_token = user.get("google_drive_refresh_token")

    if not access_token and not refresh_token:
        raise RuntimeError("Google Drive not connected for this user")

    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise RuntimeError("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET")

    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri=TOKEN_URI,
        client_id=client_id,
        client_secret=client_secret,
        scopes=SCOPES,
    )

    if creds.refresh_token:
        creds.refresh(GoogleAuthRequest())

    return build('drive', 'v3', credentials=creds), creds

def create_backup_folder(service, user_id: str) -> str:
    """Create or find a folder named Omnimise Vault Backups in Google Drive."""
    folder_name = "Omnimise Vault Backups"
    
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


def create_vault_files_folder(service) -> str:
    """Create or find a folder named Omnimise Vault Files in user's Google Drive."""
    folder_name = "Omnimise Vault Files"
    query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    response = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
    files = response.get('files', [])

    if files:
        return files[0].get('id')

    folder_metadata = {
        'name': folder_name,
        'mimeType': 'application/vnd.google-apps.folder'
    }
    folder = service.files().create(body=folder_metadata, fields='id').execute()
    return folder.get('id')


def format_drive_storage_ref(owner_user_id: str, drive_file_id: str) -> str:
    return f"drive:{owner_user_id}:{drive_file_id}"


def parse_drive_storage_ref(storage_ref: str):
    if not storage_ref or not storage_ref.startswith("drive:"):
        return None, None
    parts = storage_ref.split(":", 2)
    if len(parts) != 3:
        return None, None
    return parts[1], parts[2]


async def upload_encrypted_file_to_user_drive(user_id: str, filename: str, file_content: bytes) -> str:
    """Upload encrypted bytes to user's Drive and return storage ref for MongoDB."""
    db = get_database()
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = await db.users.find_one({"_id": user_id})

    if not user:
        raise RuntimeError("User not found for Google Drive upload")

    service, creds = authenticate_drive_for_user(user)
    folder_id = create_vault_files_folder(service)

    drive_filename = f"{filename}.enc"
    file_metadata = {
        "name": drive_filename,
        "parents": [folder_id],
    }
    media = MediaIoBaseUpload(io.BytesIO(file_content), mimetype='application/octet-stream', resumable=True)
    drive_file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()

    if creds and creds.token:
        await db.users.update_one(
            {"_id": user.get("_id")},
            {"$set": {"google_drive_access_token": creds.token}},
        )

    return format_drive_storage_ref(str(user.get("_id")), drive_file.get("id"))


async def download_drive_file_bytes(storage_ref: str) -> bytes:
    """Download Drive file bytes based on drive:<owner_user_id>:<file_id> storage ref."""
    owner_user_id, drive_file_id = parse_drive_storage_ref(storage_ref)
    if not owner_user_id or not drive_file_id:
        raise RuntimeError("Invalid Drive storage reference")

    db = get_database()
    try:
        owner_user = await db.users.find_one({"_id": ObjectId(owner_user_id)})
    except Exception:
        owner_user = await db.users.find_one({"_id": owner_user_id})

    if not owner_user:
        raise RuntimeError("Owner user not found for Drive file")

    service, creds = authenticate_drive_for_user(owner_user)
    request = service.files().get_media(fileId=drive_file_id)
    file_bytes = request.execute()

    if creds and creds.token:
        await db.users.update_one(
            {"_id": owner_user.get("_id")},
            {"$set": {"google_drive_access_token": creds.token}},
        )

    return file_bytes


async def delete_drive_file(storage_ref: str) -> bool:
    owner_user_id, drive_file_id = parse_drive_storage_ref(storage_ref)
    if not owner_user_id or not drive_file_id:
        return False

    db = get_database()
    try:
        owner_user = await db.users.find_one({"_id": ObjectId(owner_user_id)})
    except Exception:
        owner_user = await db.users.find_one({"_id": owner_user_id})

    if not owner_user:
        return False

    try:
        service, creds = authenticate_drive_for_user(owner_user)
        service.files().delete(fileId=drive_file_id).execute()
        if creds and creds.token:
            await db.users.update_one(
                {"_id": owner_user.get("_id")},
                {"$set": {"google_drive_access_token": creds.token}},
            )
        return True
    except Exception as e:
        print(f"Drive delete error: {e}")
        return False

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
            vaults = await db.vaults.find({"user_id": user_id}).to_list(length=None)
        except Exception:
            # Fallback if find returns a cursor (motor behavior varies based on await)
            cursor = db.vaults.find({"user_id": user_id})
            vaults = []
            async for v in cursor:
                vaults.append(v)

        if not vaults:
            # Backward compatibility for older data that used owner_id
            try:
                vaults = await db.vaults.find({"owner_id": user_id}).to_list(length=None)
            except Exception:
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
            
        # Spin up GCS (used for legacy/current GCS-backed docs)
        gcs_client = get_gcs_client()
        bucket = gcs_client.bucket(GCS_BUCKET_NAME)
        
        # Prepare in-memory ZIP
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
            for doc in documents:
                storage_path = doc.get("storage_url")
                if not storage_path:
                    continue

                blob_bytes = None
                if str(storage_path).startswith("drive:"):
                    try:
                        blob_bytes = await download_drive_file_bytes(storage_path)
                    except Exception as e:
                        print(f"[{user_id}] Skipping Drive file backup due to error: {e}")
                        continue
                else:
                    blob = bucket.blob(storage_path)
                    if not blob.exists():
                        continue
                    blob_bytes = blob.download_as_bytes()
                
                # We need to construct a unique, meaningful name inside the ZIP
                zip_filename = f"{doc.get('vault_id')}/{doc.get('filename')}.enc"
                
                # Write to zip
                zip_file.writestr(zip_filename, blob_bytes)
                
        zip_buffer.seek(0)
        
        # Step 2: Upload to Google Drive using user's OAuth credentials
        user = None
        try:
            user = await db.users.find_one({"_id": ObjectId(user_id)})
        except Exception:
            user = await db.users.find_one({"_id": user_id})

        if not user:
            raise RuntimeError("User not found for Drive backup")

        service, creds = authenticate_drive_for_user(user)
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

        # Persist refreshed access token if needed
        if creds and creds.token:
            await db.users.update_one(
                {"_id": user.get("_id")},
                {"$set": {"google_drive_access_token": creds.token}},
            )
        
        print(f"[{user_id}] Backup complete. Drive File ID: {drive_file.get('id')}")
        
    except Exception as e:
        print(f"[{user_id}] Backup failed: {str(e)}")
