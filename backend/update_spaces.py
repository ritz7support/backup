"""Update existing spaces with new fields"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def update_spaces():
    # Connect to MongoDB
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
    db = client[os.environ.get('DB_NAME', 'test_database')]
    
    # Update all spaces with new fields
    result = await db.spaces.update_many(
        {},
        {
            "$set": {
                "visibility": "public",
                "requires_payment": False,
                "member_count": 0,
                "is_pinned": False
            }
        }
    )
    
    print(f"Updated {result.modified_count} spaces with new fields")
    
    # Check if introductions space exists
    intro_space = await db.spaces.find_one({"id": "introductions"})
    if intro_space:
        print(f"✅ Introductions space exists with ID: {intro_space['id']}")
    else:
        print("❌ Introductions space not found")
        # List all spaces
        spaces = await db.spaces.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
        print(f"Available spaces: {spaces}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(update_spaces())
