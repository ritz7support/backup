"""
Seed default subscription tiers based on the previous hardcoded PRICING
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import uuid
from datetime import datetime, timezone

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

# Default tiers based on previous hardcoded pricing
DEFAULT_TIERS = [
    {
        "id": str(uuid.uuid4()),
        "name": "Premium Monthly (India)",
        "description": "Monthly subscription for Indian users with full access to all spaces",
        "payment_type": "recurring",
        "price_inr": 99.0,
        "price_usd": None,
        "razorpay_plan_id": None,  # To be added by admin
        "stripe_price_id": None,
        "duration_days": 30,
        "features": [
            "Access to all learning spaces",
            "Join live sessions & Q&As",
            "Community support",
            "Member directory access",
            "Event replays",
            "Direct messaging"
        ],
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Premium Yearly (India)",
        "description": "Yearly subscription for Indian users - Save ₹189 with 2 months free!",
        "payment_type": "recurring",
        "price_inr": 999.0,
        "price_usd": None,
        "razorpay_plan_id": None,  # To be added by admin
        "stripe_price_id": None,
        "duration_days": 365,
        "features": [
            "Everything in Monthly",
            "2 months free",
            "Priority support",
            "Early access to new features",
            "Exclusive community perks",
            "Certificate of completion"
        ],
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Premium Monthly (International)",
        "description": "Monthly subscription for international users with full access to all spaces",
        "payment_type": "recurring",
        "price_inr": None,
        "price_usd": 5.0,
        "razorpay_plan_id": None,
        "stripe_price_id": None,  # To be added by admin
        "duration_days": 30,
        "features": [
            "Access to all learning spaces",
            "Join live sessions & Q&As",
            "Community support",
            "Member directory access",
            "Event replays",
            "Direct messaging"
        ],
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Premium Yearly (International)",
        "description": "Yearly subscription for international users - Save $11 with 2 months free!",
        "payment_type": "recurring",
        "price_inr": None,
        "price_usd": 49.0,
        "razorpay_plan_id": None,
        "stripe_price_id": None,  # To be added by admin
        "duration_days": 365,
        "features": [
            "Everything in Monthly",
            "2 months free",
            "Priority support",
            "Early access to new features",
            "Exclusive community perks",
            "Certificate of completion"
        ],
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
]

async def seed_tiers():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Check if tiers already exist
    existing_count = await db.subscription_tiers.count_documents({})
    if existing_count > 0:
        print(f"✅ Database already has {existing_count} subscription tiers. Skipping seed.")
        return
    
    # Insert default tiers
    result = await db.subscription_tiers.insert_many(DEFAULT_TIERS)
    print(f"✅ Successfully seeded {len(result.inserted_ids)} default subscription tiers!")
    
    # Display created tiers
    for tier in DEFAULT_TIERS:
        price_info = f"₹{tier['price_inr']}" if tier['price_inr'] else f"${tier['price_usd']}"
        print(f"  - {tier['name']}: {price_info} / {tier['duration_days']} days")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_tiers())
