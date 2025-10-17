"""Mark spaces as auto-join or manual"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def configure_auto_join():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
    db = client[os.environ.get('DB_NAME', 'test_database')]
    
    # Auto-join spaces
    auto_join_spaces = ['introductions', 'ask-doubts', 'gratitude']
    
    for space_id in auto_join_spaces:
        await db.spaces.update_one(
            {"id": space_id},
            {"$set": {"auto_join": True}}
        )
        print(f"✅ Set {space_id} as auto-join")
    
    # Manual join spaces
    manual_join_spaces = ['resources', 'showcase', 'discussions']
    
    for space_id in manual_join_spaces:
        await db.spaces.update_one(
            {"id": space_id},
            {"$set": {"auto_join": False}}
        )
        print(f"✅ Set {space_id} as manual-join")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(configure_auto_join())
