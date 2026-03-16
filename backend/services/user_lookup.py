from bson import ObjectId


async def resolve_user_by_email_or_id(db, query: str):
    lookup_value = query.strip()
    if not lookup_value:
        return None

    user = await db.users.find_one({"email": lookup_value})
    if user:
        return user

    if ObjectId.is_valid(lookup_value):
        user = await db.users.find_one({"_id": ObjectId(lookup_value)})
        if user:
            return user

    return await db.users.find_one({"_id": lookup_value})