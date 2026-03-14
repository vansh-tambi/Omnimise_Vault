import os
import httpx
from fastapi import HTTPException

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
# Can be arbitrary for typical React-Google-Login generic flow, or actual redirect URI
REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "postmessage") 

async def verify_google_token_with_code(code: str) -> dict:
    """
    Exchange authorization code for tokens, then fetch profile
    """
    async with httpx.AsyncClient() as client:
        # 1. Exchange code
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        
        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange Google auth code")
            
        token_data = token_response.json()
        access_token = token_data.get("access_token")
        
        # 2. Fetch user profile
        profile_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if profile_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch Google profile")
            
        profile_data = profile_response.json()
        
        # Map back to expected structure
        return {
            "sub": profile_data.get("id"),
            "email": profile_data.get("email"),
            "name": profile_data.get("name", "Unknown"),
            "picture": profile_data.get("picture")
        }
