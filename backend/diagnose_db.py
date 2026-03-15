import os
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()

uri = os.getenv("MONGO_URI")
client = MongoClient(uri)

def diagnostic():
    try:
        dbs = client.list_database_names()
        print(f"Available databases: {dbs}")
        for db_name in dbs:
            if db_name in ['admin', 'local', 'config']: continue
            db = client[db_name]
            collections = db.list_collection_names()
            print(f"Database: {db_name} | Collections: {collections}")
            if 'vaults' in collections:
                print(f"--- Found 'vaults' in {db_name} ---")
                vaults = list(db.vaults.find().limit(5))
                for v in vaults:
                    print(f"Vault: {v.get('name')} | ID: {str(v['_id'])} | User ID: {v.get('user_id')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    diagnostic()
