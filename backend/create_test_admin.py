"""Create test admin user for the user"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import bcrypt
import uuid
from datetime import datetime, timezone

async def create_test_admin():
    # Connect to MongoDB
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
    db = client[os.environ.get('DB_NAME', 'test_database')]
    
    email = "testadmin@abcd.com"
    password = "TestAdmin2025!"
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": email})
    
    if existing_user:
        print(f"User {email} already exists")
        # Update to admin if not already
        await db.users.update_one(
            {"email": email},
            {"$set": {"role": "admin"}}
        )
        print(f"Updated user {email} to admin role")
    else:
        # Create new admin user
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": email,
            "name": "Test Admin",
            "password_hash": password_hash,
            "role": "admin",
            "bio": "Test admin account",
            "skills": [],
            "learning_goals": None,
            "location": None,
            "linkedin": None,
            "profile_picture": None,
            "is_founding_member": True,
            "is_team_member": False,
            "badges": ["founding_member"],
            "membership_tier": "paid",
            "total_points": 0,
            "referral_code": str(uuid.uuid4())[:8].upper(),
            "referred_by": None,
            "email_notifications_enabled": True,
            "last_activity_at": datetime.now(timezone.utc),
            "daily_streak": 0,
            "longest_streak": 0,
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.users.insert_one(admin_user)
        print(f"\n✅ Created test admin user successfully!")
        print(f"\n{'='*50}")
        print(f"📧 Email: {email}")
        print(f"🔑 Password: {password}")
        print(f"{'='*50}\n")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_test_admin())
