from fastapi.testclient import TestClient
from main import app
import json

client = TestClient(app)

def test_delete():
    print("Testing DELETE /vault/69b697d8b5a8e0e37896472b")
    # We don't need a real token for route matching test, 
    # but we'll see if it returns 404 (route missing) or 401 (auth)
    response = client.delete("/vault/69b697d8b5a8e0e37896472b")
    print(f"Status: {response.status_code}")
    print(f"Body: {response.text}")

    print("\nTesting GET /vault")
    response = client.get("/vault")
    print(f"Status: {response.status_code}")

if __name__ == "__main__":
    test_delete()
