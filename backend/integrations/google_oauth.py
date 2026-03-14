import os
from google.oauth2 import id_token
from google.auth.transport import requests

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "your-google-client-id")

async def verify_google_token(token: str) -> dict:
    try:
        # Verify the token
        request = requests.Request()
        idinfo = id_token.verify_oauth2_token(
            token, request, GOOGLE_CLIENT_ID
        )
        return idinfo
    except ValueError:
        # Invalid token
        return None
