from main import app

def check_vault_routes():
    print("Checking for /vault routes...")
    found = False
    for route in app.routes:
        path = getattr(route, "path", "")
        if "/vault" in path:
            methods = ",".join(getattr(route, "methods", []))
            print(f"Found: {methods} {path}")
            found = True
    if not found:
        print("No routes containing '/vault' found!")

if __name__ == "__main__":
    check_vault_routes()
