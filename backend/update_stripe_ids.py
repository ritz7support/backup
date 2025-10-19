"""
Update Stripe Price IDs for international subscription tiers
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

async def update_stripe_ids():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Update Monthly International tier
    monthly_result = await db.subscription_tiers.update_one(
        {"name": "Premium Monthly (International)"},
        {"$set": {"stripe_price_id": "price_1SJohYFJbX6FDilDjaZkdSNw"}}
    )
    
    if monthly_result.matched_count > 0:
        print("✅ Updated Premium Monthly (International) with Stripe Price ID: price_1SJohYFJbX6FDilDjaZkdSNw")
    else:
        print("❌ Could not find Premium Monthly (International) tier")
    
    # Update Yearly International tier
    yearly_result = await db.subscription_tiers.update_one(
        {"name": "Premium Yearly (International)"},
        {"$set": {"stripe_price_id": "price_1SJohYFJbX6FDilDAFe8jbJt"}}
    )
    
    if yearly_result.matched_count > 0:
        print("✅ Updated Premium Yearly (International) with Stripe Price ID: price_1SJohYFJbX6FDilDAFe8jbJt")
    else:
        print("❌ Could not find Premium Yearly (International) tier")
    
    # Display updated tiers
    print("\n📋 Current International Tiers:")
    tiers = await db.subscription_tiers.find({"price_usd": {"$ne": None}}).to_list(length=10)
    for tier in tiers:
        print(f"  - {tier['name']}")
        print(f"    Price: ${tier['price_usd']}")
        print(f"    Stripe Price ID: {tier.get('stripe_price_id', 'Not set')}")
        print(f"    Duration: {tier['duration_days']} days")
        print()
    
    client.close()

if __name__ == "__main__":
    asyncio.run(update_stripe_ids())
