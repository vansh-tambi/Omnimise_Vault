from datetime import datetime

from database.mongodb import get_database
from routes.documents import hard_delete_document


async def run_expiry_cleanup():
    db = get_database()
    cursor = db.documents.find(
        {
            "self_destruct_at": {
                "$ne": None,
                "$lte": datetime.utcnow(),
            }
        }
    )

    async for document in cursor:
        await hard_delete_document(document, db)