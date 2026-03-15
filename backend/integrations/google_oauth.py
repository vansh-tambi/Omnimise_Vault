import os
import httpx
from fastapi import HTTPException
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "postmessage")


def verify_google_id_token(credential: str) -> dict:
    """
    Verify a Google JWT ID token (credential) returned by the GoogleLogin button.
    This is the default flow from @react-oauth/google's GoogleLogin component.
    """
    try:
        idinfo = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=10
        )
        return {
            "sub": idinfo["sub"],
            "email": idinfo["email"],
            "name": idinfo.get("name", "Unknown"),
            "picture": idinfo.get("picture"),
        }
    except ValueError as e:
        print(f"GOOGLE OAUTH ERROR: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid Google ID token: {str(e)}")


async def verify_google_token_with_code(code: str) -> dict:
    """
    Exchange an authorization code for tokens, then fetch user profile.
    Used when flow='auth-code' is set on the GoogleLogin button.
    """
    async with httpx.AsyncClient() as client:
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

        profile_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )

        if profile_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch Google profile")

        profile_data = profile_response.json()
        return {
            "sub": profile_data.get("id"),
            "email": profile_data.get("email"),
            "name": profile_data.get("name", "Unknown"),
            "picture": profile_data.get("picture"),
        }
