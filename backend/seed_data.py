"""Seed initial data for ABCD community platform"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone
import uuid

async def seed_data():
    # Connect to MongoDB
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
    db = client[os.environ.get('DB_NAME', 'test_database')]
    
    # Check if already seeded
    existing_groups = await db.space_groups.count_documents({})
    if existing_groups > 0:
        print("Data already seeded. Skipping...")
        return
    
    # Space Groups
    space_groups = [
        {"id": str(uuid.uuid4()), "name": "🧱 Learning Spaces", "description": "Structured learning paths", "order": 1, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "💬 Community & Support", "description": "Connect and get help", "order": 2, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "📈 Growth & Showcases", "description": "Show your work and grow", "order": 3, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "📢 Broadcast & Updates", "description": "Stay informed", "order": 4, "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    
    await db.space_groups.insert_many(space_groups)
    print(f"Created {len(space_groups)} space groups")
    
    # Spaces
    spaces = [
        # Learning Spaces
        {"id": str(uuid.uuid4()), "space_group_id": space_groups[0]['id'], "name": "BEGIN", "description": "Bubble.io training for beginners", "icon": "🚀", "order": 1, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "space_group_id": space_groups[0]['id'], "name": "BLAZE", "description": "Automation tools: Zapier, Make, Pabbly", "icon": "⚡", "order": 2, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "space_group_id": space_groups[0]['id'], "name": "GEN", "description": "Experimental builds, AI, advanced workflows", "icon": "🧪", "order": 3, "created_at": datetime.now(timezone.utc).isoformat()},
        
        # Community & Support
        {"id": str(uuid.uuid4()), "space_group_id": space_groups[1]['id'], "name": "General Chat", "description": "Casual conversations", "icon": "💭", "order": 1, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "space_group_id": space_groups[1]['id'], "name": "Q&A Lounge", "description": "Ask questions, get answers", "icon": "❓", "order": 2, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "space_group_id": space_groups[1]['id'], "name": "Daily Office Hours", "description": "Live support sessions", "icon": "🕐", "order": 3, "created_at": datetime.now(timezone.utc).isoformat()},
        
        # Growth & Showcases
        {"id": str(uuid.uuid4()), "space_group_id": space_groups[2]['id'], "name": "Showcase Your Work", "description": "Portfolio-style feed", "icon": "🎨", "is_public": True, "order": 1, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "space_group_id": space_groups[2]['id'], "name": "Job & Internship Board", "description": "Find opportunities", "icon": "💼", "is_public": True, "order": 2, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "space_group_id": space_groups[2]['id'], "name": "Mentor Matchmaking", "description": "Connect with mentors", "icon": "🤝", "order": 3, "created_at": datetime.now(timezone.utc).isoformat()},
        
        # Broadcast & Updates
        {"id": str(uuid.uuid4()), "space_group_id": space_groups[3]['id'], "name": "Announcements", "description": "Official updates", "icon": "📣", "order": 1, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "space_group_id": space_groups[3]['id'], "name": "Community Perks", "description": "Exclusive benefits", "icon": "🎁", "requires_membership": True, "order": 2, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "space_group_id": space_groups[3]['id'], "name": "Feature Requests", "description": "Vote on new features", "icon": "💡", "order": 3, "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    
    await db.spaces.insert_many(spaces)
    print(f"Created {len(spaces)} spaces")
    
    print("Seeding completed successfully!")
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_data())
