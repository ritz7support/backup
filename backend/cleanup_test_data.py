"""
Clean up all test user data from the database
This will delete all users and associated data (posts, comments, memberships, etc.)
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

async def cleanup_all_data():
    """Remove all user data and reset database to fresh state"""
    
    print("🧹 Starting database cleanup...")
    print(f"📊 Connecting to: {MONGO_URL}/{DB_NAME}")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Get counts before cleanup
        print("\n📈 Current data counts:")
        users_count = await db.users.count_documents({})
        posts_count = await db.posts.count_documents({})
        comments_count = await db.comments.count_documents({})
        memberships_count = await db.space_memberships.count_documents({})
        messages_count = await db.direct_messages.count_documents({})
        notifications_count = await db.notifications.count_documents({})
        
        print(f"  - Users: {users_count}")
        print(f"  - Posts: {posts_count}")
        print(f"  - Comments: {comments_count}")
        print(f"  - Space Memberships: {memberships_count}")
        print(f"  - Messages: {messages_count}")
        print(f"  - Notifications: {notifications_count}")
        
        # Ask for confirmation
        print("\n⚠️  WARNING: This will delete ALL user data!")
        print("This includes:")
        print("  - All users and their profiles")
        print("  - All posts and comments")
        print("  - All space memberships")
        print("  - All messages")
        print("  - All notifications")
        print("  - All point transactions")
        print("  - All sessions")
        
        confirm = input("\n❓ Type 'DELETE ALL' to confirm: ")
        
        if confirm != "DELETE ALL":
            print("❌ Cleanup cancelled. No data was deleted.")
            return
        
        print("\n🗑️  Deleting data...")
        
        # Delete all user-related data
        result_users = await db.users.delete_many({})
        print(f"  ✅ Deleted {result_users.deleted_count} users")
        
        result_sessions = await db.user_sessions.delete_many({})
        print(f"  ✅ Deleted {result_sessions.deleted_count} sessions")
        
        result_posts = await db.posts.delete_many({})
        print(f"  ✅ Deleted {result_posts.deleted_count} posts")
        
        result_comments = await db.comments.delete_many({})
        print(f"  ✅ Deleted {result_comments.deleted_count} comments")
        
        result_memberships = await db.space_memberships.delete_many({})
        print(f"  ✅ Deleted {result_memberships.deleted_count} space memberships")
        
        result_messages = await db.direct_messages.delete_many({})
        print(f"  ✅ Deleted {result_messages.deleted_count} messages")
        
        result_notifications = await db.notifications.delete_many({})
        print(f"  ✅ Deleted {result_notifications.deleted_count} notifications")
        
        result_transactions = await db.point_transactions.delete_many({})
        print(f"  ✅ Deleted {result_transactions.deleted_count} point transactions")
        
        result_join_requests = await db.join_requests.delete_many({})
        print(f"  ✅ Deleted {result_join_requests.deleted_count} join requests")
        
        result_invites = await db.invite_tokens.delete_many({})
        print(f"  ✅ Deleted {result_invites.deleted_count} invite tokens")
        
        # Reset space member counts to 0
        result_spaces = await db.spaces.update_many({}, {"$set": {"member_count": 0}})
        print(f"  ✅ Reset member counts for {result_spaces.modified_count} spaces")
        
        # Optional: Clean up groups and group messages
        result_groups = await db.groups.delete_many({})
        print(f"  ✅ Deleted {result_groups.deleted_count} message groups")
        
        result_group_messages = await db.group_messages.delete_many({})
        print(f"  ✅ Deleted {result_group_messages.deleted_count} group messages")
        
        # Clean up user preferences
        result_prefs = await db.user_messaging_preferences.delete_many({})
        print(f"  ✅ Deleted {result_prefs.deleted_count} user preferences")
        
        print("\n✨ Cleanup completed successfully!")
        print("🎉 Database is now fresh and ready for the first user to register as admin!")
        
    except Exception as e:
        print(f"\n❌ Error during cleanup: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()
        print("\n🔌 Database connection closed")

if __name__ == "__main__":
    print("=" * 60)
    print("  DATABASE CLEANUP SCRIPT")
    print("  This will remove ALL user data from the database")
    print("=" * 60)
    asyncio.run(cleanup_all_data())
