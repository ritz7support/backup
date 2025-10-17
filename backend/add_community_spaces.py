"""Add new community spaces with slug-based IDs"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone

async def add_community_spaces():
    # Connect to MongoDB
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
    db = client[os.environ.get('DB_NAME', 'test_database')]
    
    # Get Community & Support group
    community_group = await db.space_groups.find_one({"name": "💬 Community & Support"})
    if not community_group:
        print("Community & Support group not found")
        return
    
    # Define new spaces with slug IDs
    new_spaces = [
        {
            "id": "introductions",
            "space_group_id": community_group['id'],
            "name": "Introduction",
            "description": "Introduce yourself to the community",
            "icon": "👋",
            "order": 1,
            "visibility": "public",
            "requires_payment": False,
            "member_count": 0,
            "is_pinned": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "resources",
            "space_group_id": community_group['id'],
            "name": "Resources",
            "description": "Helpful resources and recordings",
            "icon": "📚",
            "order": 2,
            "visibility": "public",
            "requires_payment": False,
            "member_count": 0,
            "is_pinned": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "ask-doubts",
            "space_group_id": community_group['id'],
            "name": "Ask-Doubts",
            "description": "Get your questions answered",
            "icon": "❓",
            "order": 3,
            "visibility": "public",
            "requires_payment": False,
            "member_count": 0,
            "is_pinned": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "gratitude",
            "space_group_id": community_group['id'],
            "name": "Gratitude",
            "description": "Share appreciation and positive vibes",
            "icon": "🙏",
            "order": 4,
            "visibility": "public",
            "requires_payment": False,
            "member_count": 0,
            "is_pinned": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "showcase",
            "space_group_id": community_group['id'],
            "name": "Showcase",
            "description": "Show off your amazing projects",
            "icon": "🎨",
            "order": 5,
            "visibility": "public",
            "requires_payment": False,
            "member_count": 0,
            "is_pinned": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "discussions",
            "space_group_id": community_group['id'],
            "name": "Discussions",
            "description": "Community discussions and debates",
            "icon": "💬",
            "order": 6,
            "visibility": "public",
            "requires_payment": False,
            "member_count": 0,
            "is_pinned": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    # Insert or update spaces
    for space in new_spaces:
        existing = await db.spaces.find_one({"id": space['id']})
        if existing:
            await db.spaces.update_one(
                {"id": space['id']},
                {"$set": space}
            )
            print(f"Updated space: {space['name']}")
        else:
            await db.spaces.insert_one(space)
            print(f"Created space: {space['name']}")
    
    print(f"\n✅ Successfully processed {len(new_spaces)} community spaces")
    client.close()

if __name__ == "__main__":
    asyncio.run(add_community_spaces())
