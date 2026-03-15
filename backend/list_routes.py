from main import app

def list_routes():
    print(f"{'Method':<10} | {'URL Path':<30} | {'Name'}")
    print("-" * 50)
    for route in app.routes:
        methods = getattr(route, "methods", None)
        path = getattr(route, "path", None)
        name = getattr(route, "name", None)
        if methods:
            m_str = ",".join(methods)
            print(f"{m_str:<10} | {path:<30} | {name}")

if __name__ == "__main__":
    list_routes()
