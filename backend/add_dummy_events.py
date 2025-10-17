"""Add dummy events to the database"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone, timedelta
import uuid

async def add_dummy_events():
    # Connect to MongoDB
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
    db = client[os.environ.get('DB_NAME', 'test_database')]
    
    # Get the first user as host (or create a system user)
    users = await db.users.find({}, {"_id": 0}).limit(1).to_list(1)
    if not users:
        print("No users found. Please create a user first.")
        return
    
    host_id = users[0]['id']
    
    # Get space IDs
    spaces = await db.spaces.find({}, {"_id": 0}).to_list(100)
    space_map = {s['name']: s['id'] for s in spaces}
    
    now = datetime.now(timezone.utc)
    
    # Check if events already exist
    existing_events = await db.events.count_documents({})
    if existing_events > 0:
        print(f"Events already exist ({existing_events}). Skipping...")
        return
    
    # Dummy events
    events = [
        {
            "id": str(uuid.uuid4()),
            "title": "Bubble.io Fundamentals Workshop",
            "description": "Learn the basics of Bubble.io and build your first app",
            "space_id": space_map.get('BEGIN'),
            "host_id": host_id,
            "event_type": "workshop",
            "start_time": (now + timedelta(days=2, hours=10)).isoformat(),
            "end_time": (now + timedelta(days=2, hours=12)).isoformat(),
            "tags": ["BEGIN", "workshop"],
            "rsvp_list": [],
            "requires_membership": False,
            "created_at": now.isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Weekly Q&A Session",
            "description": "Ask anything about no-code development and get expert answers",
            "space_id": space_map.get('Q&A Lounge'),
            "host_id": host_id,
            "event_type": "q_and_a",
            "start_time": (now + timedelta(days=5, hours=15)).isoformat(),
            "end_time": (now + timedelta(days=5, hours=16)).isoformat(),
            "tags": ["Q&A"],
            "rsvp_list": [],
            "requires_membership": False,
            "created_at": now.isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Automation with Zapier & Make",
            "description": "Deep dive into automation workflows and integrations",
            "space_id": space_map.get('BLAZE'),
            "host_id": host_id,
            "event_type": "workshop",
            "start_time": (now + timedelta(days=7, hours=14)).isoformat(),
            "end_time": (now + timedelta(days=7, hours=16)).isoformat(),
            "tags": ["BLAZE", "automation"],
            "rsvp_list": [],
            "requires_membership": True,
            "created_at": now.isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "AI Integration Masterclass",
            "description": "Learn how to integrate AI models into your no-code apps",
            "space_id": space_map.get('GEN'),
            "host_id": host_id,
            "event_type": "live_session",
            "start_time": (now + timedelta(days=10, hours=11)).isoformat(),
            "end_time": (now + timedelta(days=10, hours=13)).isoformat(),
            "tags": ["GEN", "AI"],
            "rsvp_list": [],
            "requires_membership": True,
            "created_at": now.isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Monthly Community Meetup",
            "description": "Connect with fellow builders, share projects, and network",
            "space_id": space_map.get('General Chat'),
            "host_id": host_id,
            "event_type": "live_session",
            "start_time": (now + timedelta(days=14, hours=18)).isoformat(),
            "end_time": (now + timedelta(days=14, hours=20)).isoformat(),
            "tags": ["community"],
            "rsvp_list": [],
            "requires_membership": False,
            "created_at": now.isoformat()
        },
    ]
    
    await db.events.insert_many(events)
    print(f"Added {len(events)} dummy events")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(add_dummy_events())
