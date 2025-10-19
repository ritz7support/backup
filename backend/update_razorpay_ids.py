"""
Update Razorpay Plan IDs for Indian subscription tiers
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

async def update_razorpay_ids():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Update Monthly India tier
    monthly_result = await db.subscription_tiers.update_one(
        {"name": "Premium Monthly (India)"},
        {"$set": {"razorpay_plan_id": "plan_RVD7nx743VDs8j"}}
    )
    
    if monthly_result.matched_count > 0:
        print("✅ Updated Premium Monthly (India) with Razorpay Plan ID: plan_RVD7nx743VDs8j")
    else:
        print("❌ Could not find Premium Monthly (India) tier")
    
    # Update Yearly India tier
    yearly_result = await db.subscription_tiers.update_one(
        {"name": "Premium Yearly (India)"},
        {"$set": {"razorpay_plan_id": "plan_RVD8HhIEWaz09Y"}}
    )
    
    if yearly_result.matched_count > 0:
        print("✅ Updated Premium Yearly (India) with Razorpay Plan ID: plan_RVD8HhIEWaz09Y")
    else:
        print("❌ Could not find Premium Yearly (India) tier")
    
    # Display updated tiers
    print("\n📋 Current Indian Tiers:")
    tiers = await db.subscription_tiers.find({"price_inr": {"$ne": None}}).to_list(length=10)
    for tier in tiers:
        print(f"  - {tier['name']}")
        print(f"    Price: ₹{tier['price_inr']}")
        print(f"    Razorpay Plan ID: {tier.get('razorpay_plan_id', 'Not set')}")
        print(f"    Duration: {tier['duration_days']} days")
        print()
    
    client.close()

if __name__ == "__main__":
    asyncio.run(update_razorpay_ids())
