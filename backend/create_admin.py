"""Create or update admin user"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import bcrypt
import uuid
from datetime import datetime, timezone

async def create_admin():
    # Connect to MongoDB
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
    db = client[os.environ.get('DB_NAME', 'test_database')]
    
    email = "admin@test.com"
    password = "admin123"
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        print(f"User {email} already exists with role: {existing_user.get('role')}")
        # Update to admin if not already
        if existing_user.get('role') != 'admin':
            await db.users.update_one(
                {"email": email},
                {"$set": {"role": "admin"}}
            )
            print(f"Updated user {email} to admin role")
        else:
            print("User is already an admin")
    else:
        # Create new admin user
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": email,
            "name": "Admin User",
            "password_hash": password_hash,
            "role": "admin",
            "bio": None,
            "skills": [],
            "learning_goals": None,
            "location": None,
            "linkedin": None,
            "is_founding_member": True,
            "badges": ["founding_member"],
            "membership_tier": "paid",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(admin_user)
        print(f"Created admin user: {email} / {password}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_admin())
