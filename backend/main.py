from fastapi import FastAPI
from contextlib import asynccontextmanager
from database.mongodb import connect_to_mongo, close_mongo_connection
from fastapi.middleware.cors import CORSMiddleware

from routes import auth, vault, documents, requests, access, messages

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    yield
    await close_mongo_connection()

app = FastAPI(title="Secure Document Vault", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(vault.router)
app.include_router(documents.router)
app.include_router(requests.router)
app.include_router(access.router)
app.include_router(messages.router)

@app.get("/")
async def root():
    return {"message": "Welcome to Secure Document Vault API"}
