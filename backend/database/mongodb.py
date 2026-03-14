import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "document_vault")

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None

db_config = MongoDB()

async def connect_to_mongo():
    db_config.client = AsyncIOMotorClient(MONGODB_URL)
    db_config.db = db_config.client[DATABASE_NAME]
    print("Connected to MongoDB")

async def close_mongo_connection():
    if db_config.client:
        db_config.client.close()
        print("Closed MongoDB connection")

def get_database():
    return db_config.db
