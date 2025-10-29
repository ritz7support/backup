from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Header, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import razorpay
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
import bcrypt
from urllib.parse import urlencode
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Payment gateway clients
razorpay_client = razorpay.Client(auth=(os.environ.get('RAZORPAY_KEY_ID', 'test_key'), os.environ.get('RAZORPAY_KEY_SECRET', 'test_secret')))

# SendGrid client
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
sendgrid_client = SendGridAPIClient(os.environ.get('SENDGRID_API_KEY', ''))

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

# User Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    picture: Optional[str] = None
    password_hash: Optional[str] = None
    role: str = "learner"  # learner, mentor, business_owner, admin
    bio: Optional[str] = None
    skills: List[str] = []
    learning_goals: Optional[str] = None
    location: Optional[str] = None
    linkedin: Optional[str] = None
    is_founding_member: bool = False
    is_team_member: bool = False  # New: Team Member badge feature
    badges: List[str] = []
    membership_tier: str = "free"  # free, paid
    archived: bool = False
    total_points: float = 0  # Leaderboard: Total points earned (supports fractional points)
    current_level: int = 1  # Leaderboard: Current level number
    referral_code: Optional[str] = None  # Unique referral code for this user
    referred_by: Optional[str] = None  # User ID of referrer
    last_activity_date: Optional[datetime] = None  # Last date user did any point-earning activity
    current_streak: int = 0  # Current consecutive days of activity
    longest_streak: int = 0  # Longest streak achieved
    email_notifications_enabled: bool = True  # User preference for email notifications
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "learner"

class AdminUserCreate(BaseModel):
    email: EmailStr
    name: str
    role: str = "learner"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

# Subscription Models
class Subscription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    tier_id: str  # Link to SubscriptionTier
    plan: Optional[str] = None  # Legacy: monthly_inr, yearly_inr, monthly_usd, yearly_usd
    amount: float
    currency: str  # INR, USD
    payment_gateway: str  # razorpay, stripe
    payment_type: str = "recurring"  # "one-time" or "recurring"
    status: str  # active, cancelled, expired
    starts_at: datetime
    ends_at: datetime
    auto_renew: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PaymentTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    subscription_id: Optional[str] = None
    amount: float
    currency: str
    payment_gateway: str
    gateway_payment_id: Optional[str] = None
    gateway_order_id: Optional[str] = None
    session_id: Optional[str] = None
    status: str  # pending, completed, failed
    metadata: Optional[Dict[str, Any]] = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Space Models
class SpaceGroup(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SubscriptionTier(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "Free", "Pro", "Enterprise"
    description: Optional[str] = None
    payment_type: str = "recurring"  # "one-time" or "recurring"
    price_inr: Optional[float] = None  # Price in INR (for one-time payments)
    price_usd: Optional[float] = None  # Price in USD (for one-time payments)
    razorpay_plan_id: Optional[str] = None  # For recurring INR subscriptions
    stripe_price_id: Optional[str] = None  # For recurring USD subscriptions
    duration_days: int = 30  # Billing cycle or access duration
    features: List[str] = []  # List of features
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PlatformSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "global_settings"  # Single document ID
    requires_payment_to_join: bool = False  # Global toggle for paid community
    allowed_tier_ids: List[str] = []  # Empty = any active subscription is valid
    community_name: str = "Community"  # Brand name for the platform
    primary_color: str = "#0462CB"  # Primary brand color
    logo: Optional[str] = None  # Base64 encoded logo image
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # Recipient of the notification
    type: str  # post_like, comment, comment_reply, join_approved, join_rejected, added_to_space, promoted, join_request, announcement
    title: str  # Short title for the notification
    message: str  # Detailed message
    related_entity_id: Optional[str] = None  # ID of related post, comment, space, etc.
    related_entity_type: Optional[str] = None  # post, comment, space, user
    actor_id: Optional[str] = None  # ID of user who triggered the notification
    actor_name: Optional[str] = None  # Name of user who triggered the notification
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



class OnboardingStep(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    order: int = 0
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserOnboardingProgress(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    step_id: str
    completed: bool = False
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Space(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    space_group_id: Optional[str] = None  # Optional - can be standalone
    icon: Optional[str] = None
    order: int = 0
    is_pinned: bool = False
    visibility: str = "public"  # public, private, secret
    requires_payment: bool = False
    subscription_tier_id: Optional[str] = None  # Link to subscription tier if requires_payment=True
    auto_join: bool = False  # Auto-join users when they register
    space_type: str = "post"  # post, qa, announcement, resource, event
    pinned_post_id: Optional[str] = None  # ID of the pinned post in this space
    allow_member_posts: bool = True  # If False, only admins/managers can create posts
    welcome_title: Optional[str] = None  # Custom welcome title (defaults to "Welcome to {space name}!")
    welcome_message: Optional[str] = None  # Custom welcome message (defaults to generic message)
    member_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SpaceMembership(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    space_id: str
    user_id: str
    role: str = "member"  # member, manager
    status: str = "member"  # pending, member, blocked
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    blocked_at: Optional[datetime] = None
    blocked_by: Optional[str] = None
    block_type: str = "hard"  # hard (cannot read/engage), soft (can read but cannot engage)
    block_expires_at: Optional[datetime] = None  # Auto-unblock at this time (for soft blocks)

class JoinRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    space_id: str
    status: str = "pending"  # pending, approved, rejected
    message: Optional[str] = None  # Optional message from user
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None  # Admin/manager who reviewed


class SpaceInvite(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    space_id: str
    invite_code: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])  # Short invite code
    created_by: str  # User ID who created the invite
    max_uses: Optional[int] = None  # None = unlimited uses
    uses_count: int = 0
    expires_at: Optional[datetime] = None  # Optional expiry


# ==================== LEADERBOARD MODELS ====================

class Level(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    level_number: int  # 1, 2, 3, etc.
    level_name: str = ""  # Optional name like "Beginner", "Pro"
    points_required: int  # Points needed to reach this level
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PointTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    points: float  # Points awarded (can be negative for penalties, supports fractional points)
    action_type: str  # "like", "comment", "post", "receive_like", "receive_comment", "admin_award"
    related_entity_type: Optional[str] = None  # "post", "comment"
    related_entity_id: Optional[str] = None  # ID of the post/comment
    related_user_id: Optional[str] = None  # User who performed the action (for receive actions)
    description: Optional[str] = None  # Human-readable description
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Post(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    space_id: str
    author_id: str
    title: Optional[str] = None
    content: str
    images: List[str] = []
    links: List[str] = []
    tags: List[str] = []
    is_pinned: bool = False
    reactions: Dict[str, List[str]] = {}  # {emoji: [user_ids]}
    comment_count: int = 0
    view_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Comment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    post_id: str
    author_id: str
    content: str
    parent_comment_id: Optional[str] = None
    reactions: Dict[str, List[str]] = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Event Models
class Event(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = None
    space_id: Optional[str] = None
    host_id: str
    event_type: str = "live_session"  # live_session, q_and_a, workshop
    start_time: datetime
    end_time: datetime
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None
    tags: List[str] = []
    max_attendees: Optional[int] = None
    rsvp_list: List[str] = []
    recording_url: Optional[str] = None
    requires_membership: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# DM Models
class DirectMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: str
    receiver_id: str
    content: str
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Group Message Models
class MessageGroup(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    created_by: str  # user_id of admin who created
    member_ids: List[str] = []  # user_ids who are members
    manager_ids: List[str] = []  # user_ids who can manage (add/remove members)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GroupMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    group_id: str
    sender_id: str
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Message Settings Models
class MessagingSettings(BaseModel):
    """Platform-level messaging settings"""
    model_config = ConfigDict(extra="ignore")
    id: str = "messaging_settings"  # Fixed ID for singleton
    who_can_initiate: str = "all"  # "all", "paid", "admins"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserMessagingPreferences(BaseModel):
    """User-level messaging preferences"""
    model_config = ConfigDict(extra="ignore")
    user_id: str
    allow_messages: bool = False  # Default NO - users must opt-in
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Feature Request Models
class FeatureRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    author_id: str
    title: str
    description: str
    category: str
    status: str = "pending"  # pending, under_review, planned, completed, rejected
    votes: List[str] = []  # user_ids who voted
    vote_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Invite Models
class InviteToken(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: str  # admin, mentor, business_owner, learner
    created_by: str  # user_id of admin who created the invite
    used: bool = False
    used_by: Optional[str] = None  # user_id who used the invite
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== AUTH HELPER ====================

async def get_current_user(request: Request, authorization: Optional[str] = Header(None)) -> Optional[User]:
    """Get current user from session token (cookie or Authorization header)"""
    session_token = None
    
    # Try cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token and authorization:
        if authorization.startswith("Bearer "):
            session_token = authorization[7:]
        else:
            session_token = authorization
    
    if not session_token:
        return None
    
    # Check session in database
    session = await db.user_sessions.find_one({"session_token": session_token})
    if not session or datetime.fromisoformat(session['expires_at']) < datetime.now(timezone.utc):
        return None
    
    # Get user
    user_doc = await db.users.find_one({"id": session['user_id']})
    if not user_doc:
        return None
    
    return User(**user_doc)

async def require_auth(request: Request, authorization: Optional[str] = Header(None)) -> User:
    """Require authentication, raise 401 if not authenticated"""
    user = await get_current_user(request, authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


async def get_platform_settings() -> dict:
    """Get global platform settings"""
    settings = await db.platform_settings.find_one({"id": "global_settings"})
    if not settings:
        # Create default settings if not exists
        default_settings = PlatformSettings().model_dump()
        default_settings['created_at'] = default_settings['created_at'].isoformat()
        default_settings['updated_at'] = default_settings['updated_at'].isoformat()
        await db.platform_settings.insert_one(default_settings)
        # Remove _id from returned settings
        if '_id' in default_settings:
            del default_settings['_id']
        return default_settings
    # Remove _id from returned settings
    if '_id' in settings:
        del settings['_id']
    return settings

async def user_has_active_subscription(user_id: str) -> bool:
    """Check if user has an active subscription"""
    subscription = await db.subscriptions.find_one({
        "user_id": user_id,
        "status": "active",
        "ends_at": {"$gt": datetime.now(timezone.utc).isoformat()}
    })
    return bool(subscription)

async def check_payment_requirement(user: User) -> None:
    """Check if platform requires payment and user has subscription"""
    # Admins always have access
    if user.role == 'admin':
        return
    
    settings = await get_platform_settings()
    if settings.get('requires_payment_to_join', False):
        has_subscription = await user_has_active_subscription(user.id)
        if not has_subscription:
            raise HTTPException(
                status_code=402,
                detail="Payment required. Please subscribe to access the community."
            )



# Email notification helper - Provider-agnostic interface
async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    user_id: Optional[str] = None,
    check_preferences: bool = True
):
    """
    Generic email sending function - provider-agnostic interface.
    Change email provider by modifying only this function.
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML content of email
        user_id: Optional user ID to check email preferences
        check_preferences: Whether to check user's email notification preferences
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    try:
        # Check user preferences if user_id provided
        if check_preferences and user_id:
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "email_notifications_enabled": 1})
            if user and not user.get('email_notifications_enabled', True):
                logger.info(f"Email not sent to {to_email}: User has disabled email notifications")
                return False
        
        # === SENDGRID IMPLEMENTATION (Change this section to switch providers) ===
        from_email = os.environ.get('EMAIL_FROM', 'notify@abcd.ritz7.com')
        from_name = os.environ.get('EMAIL_FROM_NAME', 'ABCD-by-Ritz7')
        reply_to = os.environ.get('EMAIL_REPLY_TO', 'abcd@ritz7.com')
        
        message = Mail(
            from_email=(from_email, from_name),
            to_emails=to_email,
            subject=subject,
            html_content=html_content
        )
        message.reply_to = reply_to
        
        response = sendgrid_client.send(message)
        success = response.status_code == 202
        # === END SENDGRID IMPLEMENTATION ===
        
        if success:
            logger.info(f"✅ Email sent to {to_email}: {subject}")
        else:
            logger.warning(f"⚠️ Email send failed to {to_email}: Status {response.status_code}")
        
        return success
        
    except Exception as e:
        logger.error(f"❌ Failed to send email to {to_email}: {str(e)}")
        return False

# Legacy function name for backward compatibility
async def send_email_notification(to_email: str, subject: str, html_content: str):
    """Legacy function - redirects to send_email()"""
    return await send_email(to_email, subject, html_content, check_preferences=False)


# ==================== EMAIL TEMPLATES ====================

def get_email_template(template_type: str, **kwargs) -> dict:
    """
    Get email subject and HTML content for different email types.
    Centralized template management for easy updates.
    
    Args:
        template_type: Type of email (welcome, join_approved, join_rejected, streak_7, streak_30, announcement)
        **kwargs: Template-specific variables
    
    Returns:
        dict: {"subject": str, "html": str}
    """
    
    base_style = """
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #0462CB; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #0462CB; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; color: #8E8E8E; font-size: 12px; margin-top: 20px; }
    </style>
    """
    
    templates = {
        "welcome": {
            "subject": "Welcome to ABCD Community! 🎉",
            "html": f"""
            <!DOCTYPE html>
            <html>
            <head>{base_style}</head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome to ABCD!</h1>
                    </div>
                    <div class="content">
                        <h2>Hi {kwargs.get('user_name', 'there')}! 👋</h2>
                        <p>We're thrilled to have you join the ABCD community. You're now part of a vibrant network of learners, mentors, and innovators.</p>
                        
                        <p><strong>Here's what you can do:</strong></p>
                        <ul>
                            <li>🎯 Join spaces that interest you</li>
                            <li>💬 Engage with posts and comments</li>
                            <li>🔥 Build your activity streak</li>
                            <li>🏆 Earn points and level up</li>
                        </ul>
                        
                        <p style="text-align: center;">
                            <a href="{kwargs.get('dashboard_url', '#')}" class="button">Go to Dashboard</a>
                        </p>
                        
                        <p>If you have any questions, feel free to reply to this email.</p>
                        
                        <p>Happy learning!<br>
                        The ABCD Team</p>
                    </div>
                    <div class="footer">
                        <p>© 2025 ABCD by Ritz7. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            """
        },
        
        "join_approved": {
            "subject": f"Your request to join {kwargs.get('space_name', 'a space')} was approved! ✅",
            "html": f"""
            <!DOCTYPE html>
            <html>
            <head>{base_style}</head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Request Approved!</h1>
                    </div>
                    <div class="content">
                        <h2>Great news, {kwargs.get('user_name', 'there')}! 🎉</h2>
                        <p>Your request to join <strong>{kwargs.get('space_name', 'the space')}</strong> has been approved.</p>
                        
                        <p>You can now:</p>
                        <ul>
                            <li>📝 Create posts</li>
                            <li>💬 Comment on discussions</li>
                            <li>❤️ React to content</li>
                            <li>🤝 Connect with members</li>
                        </ul>
                        
                        <p style="text-align: center;">
                            <a href="{kwargs.get('space_url', '#')}" class="button">Visit Space</a>
                        </p>
                        
                        <p>Welcome aboard!<br>
                        The ABCD Team</p>
                    </div>
                    <div class="footer">
                        <p>© 2025 ABCD by Ritz7. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            """
        },
        
        "join_rejected": {
            "subject": f"Update on your request to join {kwargs.get('space_name', 'a space')}",
            "html": f"""
            <!DOCTYPE html>
            <html>
            <head>{base_style}</head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Join Request Update</h1>
                    </div>
                    <div class="content">
                        <h2>Hi {kwargs.get('user_name', 'there')},</h2>
                        <p>We wanted to let you know that your request to join <strong>{kwargs.get('space_name', 'the space')}</strong> was not approved at this time.</p>
                        
                        <p>Don't worry! There are many other amazing spaces in the ABCD community where you can contribute and learn.</p>
                        
                        <p style="text-align: center;">
                            <a href="{kwargs.get('spaces_url', '#')}" class="button">Explore Other Spaces</a>
                        </p>
                        
                        <p>Best regards,<br>
                        The ABCD Team</p>
                    </div>
                    <div class="footer">
                        <p>© 2025 ABCD by Ritz7. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            """
        },
        
        "streak_7": {
            "subject": "🔥 7-Day Activity Streak! You earned bonus points!",
            "html": f"""
            <!DOCTYPE html>
            <html>
            <head>{base_style}</head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔥 7-Day Streak!</h1>
                    </div>
                    <div class="content">
                        <h2>Congratulations, {kwargs.get('user_name', 'there')}! 🎉</h2>
                        <p style="font-size: 18px; text-align: center; background-color: #FEF3C7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            You've maintained a <strong>7-day activity streak</strong>!<br>
                            <span style="font-size: 32px; color: #F59E0B;">🔥</span><br>
                            <strong style="color: #0462CB; font-size: 24px;">+7 Bonus Points</strong>
                        </p>
                        
                        <p>Your consistency is paying off! Keep engaging with the community to maintain your streak and unlock more rewards.</p>
                        
                        <p><strong>Next milestone:</strong> 30-day streak = 50 bonus points! 🎯</p>
                        
                        <p style="text-align: center;">
                            <a href="{kwargs.get('profile_url', '#')}" class="button">View Your Profile</a>
                        </p>
                        
                        <p>Keep up the amazing work!<br>
                        The ABCD Team</p>
                    </div>
                    <div class="footer">
                        <p>© 2025 ABCD by Ritz7. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            """
        },
        
        "streak_30": {
            "subject": "🏆 30-Day Activity Streak! Epic achievement!",
            "html": f"""
            <!DOCTYPE html>
            <html>
            <head>{base_style}</head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🏆 30-Day Streak!</h1>
                    </div>
                    <div class="content">
                        <h2>INCREDIBLE, {kwargs.get('user_name', 'there')}! 🎊</h2>
                        <p style="font-size: 18px; text-align: center; background-color: #FEF3C7; padding: 30px; border-radius: 8px; margin: 20px 0;">
                            You've achieved a <strong>30-day activity streak</strong>!<br>
                            <span style="font-size: 48px; color: #F59E0B;">🔥🔥🔥</span><br>
                            <strong style="color: #0462CB; font-size: 28px;">+50 Bonus Points</strong>
                        </p>
                        
                        <p>Your dedication to the ABCD community is outstanding! This is a remarkable achievement that few reach.</p>
                        
                        <p><strong>You're an inspiration to the community!</strong> 💪</p>
                        
                        <p style="text-align: center;">
                            <a href="{kwargs.get('profile_url', '#')}" class="button">View Your Profile</a>
                        </p>
                        
                        <p>Phenomenal work!<br>
                        The ABCD Team</p>
                    </div>
                    <div class="footer">
                        <p>© 2025 ABCD by Ritz7. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            """
        },
        
        "announcement": {
            "subject": kwargs.get('announcement_title', 'Important Announcement from ABCD'),
            "html": f"""
            <!DOCTYPE html>
            <html>
            <head>{base_style}</head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📢 Announcement</h1>
                    </div>
                    <div class="content">
                        <h2>{kwargs.get('announcement_title', 'Community Update')}</h2>
                        <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            {kwargs.get('announcement_content', '')}
                        </div>
                        
                        <p style="text-align: center;">
                            <a href="{kwargs.get('announcement_url', '#')}" class="button">Learn More</a>
                        </p>
                        
                        <p>Best regards,<br>
                        The ABCD Team</p>
                    </div>
                    <div class="footer">
                        <p>© 2025 ABCD by Ritz7. All rights reserved.</p>
                        <p><a href="{kwargs.get('unsubscribe_url', '#')}" style="color: #8E8E8E;">Manage Email Preferences</a></p>
                    </div>
                </div>
            </body>
            </html>
            """
        }
    }
    
    return templates.get(template_type, {
        "subject": "Notification from ABCD",
        "html": f"<p>{kwargs.get('message', 'You have a new notification.')}</p>"
    })


# Notification creation helper
async def create_notification(
    user_id: str,
    notif_type: str,
    title: str,
    message: str,
    related_entity_id: Optional[str] = None,
    related_entity_type: Optional[str] = None,
    actor_id: Optional[str] = None,
    actor_name: Optional[str] = None,
    send_email: bool = False
):
    """Create a notification and optionally send email"""
    notification = Notification(
        user_id=user_id,
        type=notif_type,
        title=title,
        message=message,
        related_entity_id=related_entity_id,
        related_entity_type=related_entity_type,
        actor_id=actor_id,
        actor_name=actor_name
    )
    
    notif_dict = notification.model_dump()
    notif_dict['created_at'] = notif_dict['created_at'].isoformat()
    await db.notifications.insert_one(notif_dict)
    
    # Send email if requested and email is important
    if send_email:
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "email": 1, "name": 1})
        if user and user.get('email'):
            html_content = f"""
            <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #0462CB;">{title}</h2>
                        <p>{message}</p>
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                            <p style="font-size: 12px; color: #888;">
                                This is an automated notification from your community platform.
                            </p>
                        </div>
                    </div>
                </body>
            </html>
            """
            await send_email_notification(user['email'], title, html_content)
    
    return notification




# ==================== WEBSOCKET CONNECTION MANAGER ====================

class ConnectionManager:
    """Manages WebSocket connections for real-time messaging"""
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}  # user_id: websocket
    
    async def connect(self, user_id: str, websocket: WebSocket):
        """Connect a user's websocket"""
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"User {user_id} connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, user_id: str):
        """Disconnect a user's websocket"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"User {user_id} disconnected. Total connections: {len(self.active_connections)}")
    
    async def send_personal_message(self, user_id: str, message: dict):
        """Send a message to a specific user"""
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except Exception as e:
                logger.error(f"Error sending message to {user_id}: {e}")
                self.disconnect(user_id)
    
    async def broadcast_to_group(self, user_ids: List[str], message: dict):
        """Broadcast a message to multiple users"""
        for user_id in user_ids:
            await self.send_personal_message(user_id, message)

# Initialize connection manager
ws_manager = ConnectionManager()

# ==================== REFERRAL HELPERS ====================

def generate_referral_code(user_id: str, name: str) -> str:
    """Generate a unique referral code based on user info"""
    import hashlib
    # Create code from first 3 letters of name + hash of user_id
    name_part = ''.join(filter(str.isalnum, name[:3])).upper()
    hash_part = hashlib.md5(user_id.encode()).hexdigest()[:6].upper()
    return f"{name_part}{hash_part}"

async def get_or_create_referral_code(user_id: str) -> str:
    """Get existing referral code or create a new one"""
    user = await db.users.find_one({"id": user_id})
    if user and user.get('referral_code'):
        return user['referral_code']
    
    # Generate new code
    referral_code = generate_referral_code(user_id, user.get('name', 'USER'))
    
    # Ensure uniqueness
    existing = await db.users.find_one({"referral_code": referral_code})
    counter = 1
    while existing:
        referral_code = f"{referral_code}{counter}"
        existing = await db.users.find_one({"referral_code": referral_code})
        counter += 1
    
    # Update user with referral code
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"referral_code": referral_code}}
    )
    
    return referral_code

def calculate_credits_from_points(points: int, currency: str = "INR") -> float:
    """
    Calculate credit value from points
    1 point = ₹1 INR
    1 point = $0.05 USD (based on ₹99 = $5 ratio)
    """
    if currency == "USD":
        return round(points * 0.05, 2)  # $0.05 per point
    else:
        return float(points)  # ₹1 per point

async def award_referral_points(referrer_id: str, referee_id: str, referee_name: str):
    """Award points to referrer when referee completes registration"""
    REFERRAL_POINTS = 50  # Points for successful referral
    WELCOME_BONUS = 25   # Welcome bonus for referee
    
    # Award points to referrer
    await db.users.update_one(
        {"id": referrer_id},
        {"$inc": {"total_points": REFERRAL_POINTS}}
    )
    
    # Award welcome bonus to referee
    await db.users.update_one(
        {"id": referee_id},
        {"$inc": {"total_points": WELCOME_BONUS}}
    )
    
    # Create notification for referrer
    await create_notification(
        user_id=referrer_id,
        notif_type="referral_success",
        title="Referral Successful! 🎉",
        message=f"{referee_name} joined using your referral link! You earned {REFERRAL_POINTS} points.",
        actor_id=referee_id,
        actor_name=referee_name
    )
    
    # Create notification for referee
    await create_notification(
        user_id=referee_id,
        notif_type="welcome_bonus",
        title="Welcome Bonus! 🎁",
        message=f"You received {WELCOME_BONUS} bonus points for joining through a referral link!"
    )



async def is_space_manager_or_admin(user: User, space_id: str) -> bool:
    """Check if user is an admin or manager of the space"""
    if user.role == 'admin':
        return True
    
    membership = await db.space_memberships.find_one({
        "user_id": user.id,
        "space_id": space_id,
        "role": "manager"
    })
    return bool(membership)

async def is_space_member(user: User, space_id: str) -> bool:
    """Check if user is a member of the space"""
    if user.role == 'admin':
        return True
    
    membership = await db.space_memberships.find_one({
        "user_id": user.id,
        "space_id": space_id,
        "status": "member"
    })
    return bool(membership)


async def check_and_unblock_expired_memberships(user_id: str, space_id: str):
    """Check if a user's block has expired and auto-unblock them"""
    membership = await db.space_memberships.find_one({
        "user_id": user_id,
        "space_id": space_id,
        "status": "blocked"
    })
    
    if not membership:
        return None
    
    # Check if block has an expiry date
    block_expires_at = membership.get('block_expires_at')
    if block_expires_at:
        try:
            expiry_datetime = datetime.fromisoformat(block_expires_at.replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            
            # If block has expired, auto-unblock
            if now >= expiry_datetime:
                await db.space_memberships.update_one(
                    {
                        "user_id": user_id,
                        "space_id": space_id
                    },
                    {
                        "$set": {
                            "status": "member",
                            "blocked_at": None,
                            "blocked_by": None,
                            "block_type": "hard",
                            "block_expires_at": None
                        }
                    }
                )
                return "unblocked"
        except Exception as e:
            logger.error(f"Error checking block expiry: {e}")
    
    return "blocked"

async def get_effective_block_status(user_id: str, space_id: str) -> dict:
    """Get the effective block status for a user in a space, checking for expiry"""
    # First, check and auto-unblock if expired
    await check_and_unblock_expired_memberships(user_id, space_id)
    
    # Re-fetch membership to get current status
    membership = await db.space_memberships.find_one({
        "user_id": user_id,
        "space_id": space_id
    })
    
    if not membership:
        return {"is_blocked": False, "block_type": None}
    
    if membership.get('status') != 'blocked':
        return {"is_blocked": False, "block_type": None}
    
    block_type = membership.get('block_type', 'hard')
    return {
        "is_blocked": True,
        "block_type": block_type,
        "blocked_at": membership.get('blocked_at'),
        "block_expires_at": membership.get('block_expires_at')
    }


# ==================== POINTS & LEADERBOARD HELPERS ====================

async def award_points(user_id: str, points: float, action_type: str, related_entity_type: str = None, 
                       related_entity_id: str = None, related_user_id: str = None, description: str = None):
    """Award points to a user and create a transaction record"""
    # Create point transaction
    transaction = PointTransaction(
        user_id=user_id,
        points=points,
        action_type=action_type,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
        related_user_id=related_user_id,
        description=description
    )
    
    transaction_dict = transaction.model_dump()
    transaction_dict['created_at'] = transaction_dict['created_at'].isoformat()
    await db.point_transactions.insert_one(transaction_dict)
    
    # Update user's total points
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"total_points": points}}
    )
    
    # Check and update level
    await update_user_level(user_id)


async def track_activity_streak(user_id: str):
    """Track user's daily activity streak and award milestone bonuses"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        return
    
    today = datetime.now(timezone.utc).date()
    last_activity = user.get('last_activity_date')
    current_streak = user.get('current_streak', 0)
    longest_streak = user.get('longest_streak', 0)
    
    # Convert last_activity to date if it exists
    if last_activity:
        if isinstance(last_activity, datetime):
            last_activity_date = last_activity.date()
        else:
            # If stored as string, parse it
            last_activity_date = datetime.fromisoformat(last_activity.replace('Z', '+00:00')).date()
    else:
        last_activity_date = None
    
    # If activity already tracked today, do nothing
    if last_activity_date == today:
        return
    
    # Check if streak continues (yesterday) or breaks
    if last_activity_date:
        days_diff = (today - last_activity_date).days
        
        if days_diff == 1:
            # Streak continues
            new_streak = current_streak + 1
            
            # Check for milestone bonuses
            bonus_points = 0
            send_milestone_email = False
            email_template_type = None
            
            if new_streak == 7:
                bonus_points = 7
                send_milestone_email = True
                email_template_type = "streak_7"
                await create_notification(
                    user_id=user_id,
                    notification_type="streak_milestone",
                    title="🔥 7-Day Streak!",
                    message=f"You've earned 7 bonus points for a 7-day activity streak!"
                )
            elif new_streak == 30:
                bonus_points = 50
                send_milestone_email = True
                email_template_type = "streak_30"
                await create_notification(
                    user_id=user_id,
                    notification_type="streak_milestone",
                    title="🔥 30-Day Streak!",
                    message=f"Amazing! You've earned 50 bonus points for a 30-day activity streak!"
                )
            
            # Award bonus points if milestone reached
            if bonus_points > 0:
                await db.users.update_one(
                    {"id": user_id},
                    {"$inc": {"total_points": bonus_points}}
                )
                await update_user_level(user_id)
            
            # Send email for milestone
            if send_milestone_email and email_template_type:
                try:
                    email_template = get_email_template(
                        email_template_type,
                        user_name=user.get('name', 'there'),
                        profile_url=f"{os.environ.get('FRONTEND_URL', '')}/profile"
                    )
                    await send_email(
                        to_email=user.get('email'),
                        subject=email_template["subject"],
                        html_content=email_template["html"],
                        user_id=user_id,
                        check_preferences=True
                    )
                except Exception as e:
                    logger.error(f"Failed to send streak milestone email: {e}")
            
            # Update longest streak if needed
            new_longest = max(longest_streak, new_streak)
            
            await db.users.update_one(
                {"id": user_id},
                {
                    "$set": {
                        "last_activity_date": today.isoformat(),
                        "current_streak": new_streak,
                        "longest_streak": new_longest
                    }
                }
            )
        else:
            # Streak broken, reset to 1
            await db.users.update_one(
                {"id": user_id},
                {
                    "$set": {
                        "last_activity_date": today.isoformat(),
                        "current_streak": 1
                    }
                }
            )
    else:
        # First activity ever
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "last_activity_date": today.isoformat(),
                    "current_streak": 1,
                    "longest_streak": 1
                }
            }
        )


async def update_user_level(user_id: str):
    """Update user's level based on their total points"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        return
    
    total_points = user.get('total_points', 0)
    
    # Get all levels sorted by points_required descending
    levels = await db.levels.find({}, {"_id": 0}).sort("points_required", -1).to_list(100)
    
    # Find the highest level the user qualifies for
    new_level = 1
    for level in levels:
        if total_points >= level['points_required']:
            new_level = level['level_number']
            break
    
    # Update user's level if it changed
    current_level = user.get('current_level', 1)
    if new_level != current_level:
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"current_level": new_level}}
        )

async def get_user_leaderboard_stats(user_id: str):
    """Get user's leaderboard statistics including next level info"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return None
    
    total_points = user.get('total_points', 0)
    current_level = user.get('current_level', 1)
    
    # Get current level details
    current_level_obj = await db.levels.find_one({"level_number": current_level}, {"_id": 0})
    
    # Get next level
    next_level_obj = await db.levels.find_one({"level_number": current_level + 1}, {"_id": 0})
    
    points_to_next_level = None
    next_level_points = None
    if next_level_obj:
        next_level_points = next_level_obj['points_required']
        points_to_next_level = next_level_points - total_points
    
    return {
        "user_id": user_id,
        "total_points": total_points,
        "current_level": current_level,
        "current_level_name": current_level_obj.get('level_name') if current_level_obj else f"Level {current_level}",
        "next_level": current_level + 1 if next_level_obj else None,
        "next_level_points": next_level_points,
        "points_to_next_level": points_to_next_level
    }


# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register")
async def register(user_data: UserCreate, response: Response, invite_token: Optional[str] = None, ref: Optional[str] = None):
    """Register new user with email/password and optional referral code"""
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate referral code if provided
    referrer_id = None
    if ref:
        referrer = await db.users.find_one({"referral_code": ref})
        if referrer:
            referrer_id = referrer['id']
        else:
            # Don't fail registration if referral code is invalid, just ignore it
            logger.warning(f"Invalid referral code used: {ref}")
    
    # Handle invite token if provided
    role = user_data.role
    if invite_token:
        invite = await db.invite_tokens.find_one({"token": invite_token}, {"_id": 0})
        if not invite:
            raise HTTPException(status_code=400, detail="Invalid invite link")
        
        # Convert expires_at from ISO string to datetime if needed
        if isinstance(invite.get('expires_at'), str):
            invite['expires_at'] = datetime.fromisoformat(invite['expires_at'].replace('Z', '+00:00'))
        
        invite_obj = InviteToken(**invite)
        
        if invite_obj.used:
            raise HTTPException(status_code=400, detail="This invite link has already been used")
        
        # Ensure both datetimes are timezone-aware for comparison
        now = datetime.now(timezone.utc)
        expires_at = invite_obj.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if now > expires_at:
            raise HTTPException(status_code=400, detail="This invite link has expired")
        
        # Use role from invite token
        role = invite_obj.role
    
    # Check if this is the first user - automatically make them admin
    user_count = await db.users.count_documents({})
    if user_count == 0:
        role = "admin"
        logger.info(f"First user registration detected - automatically assigning admin role to {user_data.email}")
    
    # Check founding member status (first 100 users)
    is_founding = user_count < 100
    
    # Hash password
    password_hash = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Create user
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=role,
        password_hash=password_hash,
        is_founding_member=is_founding,
        badges=["🎉 Founding 100"] if is_founding else [],
        referred_by=referrer_id  # Store referrer ID
    )
    
    user_dict = user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    await db.users.insert_one(user_dict)
    
    # Auto-join user to auto-join spaces
    auto_join_spaces = await db.spaces.find({"auto_join": True}, {"_id": 0, "id": 1}).to_list(100)
    for space in auto_join_spaces:
        membership = SpaceMembership(
            space_id=space['id'],
            user_id=user.id,
            status="member"
        )
        membership_dict = membership.model_dump()
        membership_dict['joined_at'] = membership_dict['joined_at'].isoformat()
        await db.space_memberships.insert_one(membership_dict)
        # Update member count
        await db.spaces.update_one({"id": space['id']}, {"$inc": {"member_count": 1}})
    
    # Mark invite token as used
    if invite_token:
        await db.invite_tokens.update_one(
            {"token": invite_token},
            {"$set": {"used": True, "used_by": user.id}}
        )
    
    # Award referral points if user was referred
    if referrer_id:
        await award_referral_points(referrer_id, user.id, user.name)
    
    # Create session
    session_token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    session = UserSession(
        user_id=user.id,
        session_token=session_token,
        expires_at=expires_at
    )
    session_dict = session.model_dump()
    session_dict['created_at'] = session_dict['created_at'].isoformat()
    session_dict['expires_at'] = session_dict['expires_at'].isoformat()
    await db.user_sessions.insert_one(session_dict)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7*24*60*60,
        path="/"
    )
    
    # Send welcome email
    try:
        email_template = get_email_template(
            "welcome",
            user_name=user.name,
            dashboard_url=f"{os.environ.get('FRONTEND_URL', '')}/dashboard"
        )
        await send_email(
            to_email=user.email,
            subject=email_template["subject"],
            html_content=email_template["html"],
            user_id=user.id,
            check_preferences=False  # Always send welcome email
        )
    except Exception as e:
        logger.error(f"Failed to send welcome email to {user.email}: {e}")
    
    return {"user": user, "session_token": session_token}

@api_router.post("/auth/login")
async def login(credentials: UserLogin, response: Response):
    """Login with email/password"""
    user_doc = await db.users.find_one({"email": credentials.email})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if user is archived
    if user_doc.get('archived', False):
        raise HTTPException(status_code=403, detail="Account has been archived. Please contact support.")
    
    # Verify password
    if not user_doc.get('password_hash'):
        raise HTTPException(status_code=401, detail="Password login not available for this account")
    
    if not bcrypt.checkpw(credentials.password.encode('utf-8'), user_doc['password_hash'].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create session
    session_token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    session = UserSession(
        user_id=user_doc['id'],
        session_token=session_token,
        expires_at=expires_at
    )
    session_dict = session.model_dump()
    session_dict['created_at'] = session_dict['created_at'].isoformat()
    session_dict['expires_at'] = session_dict['expires_at'].isoformat()
    await db.user_sessions.insert_one(session_dict)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7*24*60*60,
        path="/"
    )
    
    user = User(**user_doc)
    return {"user": user, "session_token": session_token}

@api_router.get("/auth/google")
async def google_auth(redirect_url: str):
    """Redirect to Google OAuth"""
    auth_url = f"https://auth.emergentagent.com/?redirect={redirect_url}"
    return {"auth_url": auth_url}

@api_router.post("/auth/session")
async def process_session(request: Request, response: Response, x_session_id: str = Header(..., alias="X-Session-ID")):
    """Process Google OAuth session and create user session"""
    # Call Emergent auth endpoint
    async with httpx.AsyncClient() as client:
        try:
            response_data = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": x_session_id}
            )
            response_data.raise_for_status()
            oauth_data = response_data.json()
        except Exception as e:
            logger.error(f"OAuth error: {e}")
            raise HTTPException(status_code=400, detail="Invalid session ID")
    
    # Check if user exists
    user_doc = await db.users.find_one({"email": oauth_data['email']})
    
    # Check founding member status
    user_count = await db.users.count_documents({})
    is_founding = user_count < 100
    
    if not user_doc:
        # Create new user
        user = User(
            email=oauth_data['email'],
            name=oauth_data['name'],
            picture=oauth_data.get('picture'),
            is_founding_member=is_founding,
            badges=["🎉 Founding 100"] if is_founding else []
        )
        user_dict = user.model_dump()
        user_dict['created_at'] = user_dict['created_at'].isoformat()
        await db.users.insert_one(user_dict)
        user_id = user.id
    else:
        user_id = user_doc['id']
    
    # Create session
    session_token = oauth_data['session_token']
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    session = UserSession(
        user_id=user_id,
        session_token=session_token,
        expires_at=expires_at
    )
    session_dict = session.model_dump()
    session_dict['created_at'] = session_dict['created_at'].isoformat()
    session_dict['expires_at'] = session_dict['expires_at'].isoformat()
    await db.user_sessions.insert_one(session_dict)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7*24*60*60,
        path="/"
    )
    
    return {"session_token": session_token, "user_id": user_id}

@api_router.get("/auth/me")
async def get_me(user: User = Depends(require_auth)):
    """Get current user"""
    return user


@api_router.put("/users/profile-picture")
async def update_profile_picture(request: Request, user: User = Depends(require_auth)):
    """Update user's profile picture"""
    data = await request.json()
    picture_data = data.get('picture')
    
    if not picture_data:
        raise HTTPException(status_code=400, detail="Picture data is required")
    
    # Validate that it's a base64 image
    if not picture_data.startswith('data:image'):
        raise HTTPException(status_code=400, detail="Invalid image format")
    
    # Update user's picture
    result = await db.users.update_one(
        {"id": user.id},
        {"$set": {"picture": picture_data}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Profile picture updated successfully", "picture": picture_data}

@api_router.delete("/users/profile-picture")
async def remove_profile_picture(user: User = Depends(require_auth)):
    """Remove user's profile picture"""
    result = await db.users.update_one(
        {"id": user.id},
        {"$set": {"picture": None}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Profile picture removed successfully"}


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
        response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ==================== INVITE ENDPOINTS ====================

@api_router.post("/invites/generate")
async def generate_invite_link(role: str, user: User = Depends(require_auth)):
    """Generate an invite link with specific role (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can generate invite links")
    
    if role not in ['admin', 'mentor', 'business_owner', 'learner']:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    # Create invite token that expires in 7 days
    invite = InviteToken(
        role=role,
        created_by=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    
    # Convert to dict and handle datetime serialization
    invite_dict = invite.model_dump()
    invite_dict['expires_at'] = invite_dict['expires_at'].isoformat()
    invite_dict['created_at'] = invite_dict['created_at'].isoformat()
    
    await db.invite_tokens.insert_one(invite_dict)
    
    return {
        "token": invite.token,
        "role": invite.role,
        "expires_at": invite.expires_at.isoformat()
    }

@api_router.post("/invites/create-user")
async def admin_create_user(user_data: AdminUserCreate, user: User = Depends(require_auth)):
    """Admin directly creates a user without logging in as them"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can create users directly")
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check founding member status (first 100 users)
    user_count = await db.users.count_documents({})
    is_founding = user_count < 100
    
    # Generate random password
    random_password = str(uuid.uuid4())[:12]
    password_hash = bcrypt.hashpw(random_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Create user
    new_user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        password_hash=password_hash,
        is_founding_member=is_founding,
        badges=["🎉 Founding 100"] if is_founding else []
    )
    
    user_dict = new_user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    await db.users.insert_one(user_dict)
    
    return {
        "user": {
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email,
            "role": new_user.role
        },
        "message": f"User {user_data.name} created successfully"
    }

@api_router.get("/invites/validate/{token}")
async def validate_invite_token(token: str):
    """Validate an invite token"""
    invite = await db.invite_tokens.find_one({"token": token}, {"_id": 0})
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid invite link")
    
    # Convert expires_at from ISO string to datetime if needed
    if isinstance(invite.get('expires_at'), str):
        invite['expires_at'] = datetime.fromisoformat(invite['expires_at'].replace('Z', '+00:00'))
    
    invite_obj = InviteToken(**invite)
    
    if invite_obj.used:
        raise HTTPException(status_code=400, detail="This invite link has already been used")
    
    # Ensure both datetimes are timezone-aware for comparison
    now = datetime.now(timezone.utc)
    expires_at = invite_obj.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if now > expires_at:
        raise HTTPException(status_code=400, detail="This invite link has expired")
    
    return {
        "valid": True,
        "role": invite_obj.role
    }

@api_router.get("/invites")
async def get_invite_links(user: User = Depends(require_auth)):
    """Get all invite links created by the current admin"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can view invite links")
    
    invites = await db.invite_tokens.find(
        {"created_by": user.id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"invites": invites}

# ==================== PAYMENT ENDPOINTS ====================

@api_router.post("/payments/create-order")
async def create_payment_order(request: Request, tier_id: str, currency: str, user: User = Depends(require_auth)):
    """Create payment order (Razorpay or Stripe) based on subscription tier with auto-applied credits"""
    # Get tier from database
    tier = await db.subscription_tiers.find_one({"id": tier_id, "is_active": True})
    if not tier:
        raise HTTPException(status_code=400, detail="Invalid or inactive subscription tier")
    
    # Get user's current points and calculate available credits
    current_user = await db.users.find_one({"id": user.id}, {"_id": 0, "total_points": 1})
    total_points = current_user.get('total_points', 0)
    
    # Determine amount and gateway based on currency
    if currency == "INR":
        if tier['payment_type'] == 'one-time':
            original_amount = tier.get('price_inr')
            if not original_amount:
                raise HTTPException(status_code=400, detail="INR pricing not available for this tier")
        else:
            if not tier.get('razorpay_plan_id'):
                raise HTTPException(status_code=400, detail="Razorpay plan ID not configured for this tier")
            original_amount = tier.get('price_inr', 0)
        gateway = 'razorpay'
        
        # Calculate credits to apply (1 point = ₹1)
        available_credits = calculate_credits_from_points(total_points, "INR")
        credits_to_apply = min(available_credits, original_amount)  # Can't apply more than order total
        
    elif currency == "USD":
        if tier['payment_type'] == 'one-time':
            original_amount = tier.get('price_usd')
            if not original_amount:
                raise HTTPException(status_code=400, detail="USD pricing not available for this tier")
        else:
            if not tier.get('stripe_price_id'):
                raise HTTPException(status_code=400, detail="Stripe price ID not configured for this tier")
            original_amount = tier.get('price_usd', 0)
        gateway = 'stripe'
        
        # Calculate credits to apply (1 point = $0.05)
        available_credits = calculate_credits_from_points(total_points, "USD")
        credits_to_apply = min(available_credits, original_amount)
        
    else:
        raise HTTPException(status_code=400, detail="Invalid currency. Use INR or USD")
    
    # Calculate final amount after applying credits
    final_amount = max(0, original_amount - credits_to_apply)
    
    # Calculate points to deduct (reverse calculation)
    if currency == "INR":
        points_to_deduct = int(credits_to_apply)  # 1 point = ₹1
    else:
        points_to_deduct = int(credits_to_apply / 0.05)  # 1 point = $0.05
    
    if gateway == 'razorpay':
        # Razorpay order
        try:
            # If final amount is 0 (fully covered by credits), skip payment
            if final_amount <= 0:
                # Deduct points and activate subscription immediately
                await db.users.update_one(
                    {"id": user.id},
                    {"$inc": {"total_points": -points_to_deduct}}
                )
                
                # Create subscription record
                subscription = Subscription(
                    user_id=user.id,
                    tier_id=tier_id,
                    status='active',
                    start_date=datetime.now(timezone.utc),
                    end_date=datetime.now(timezone.utc) + timedelta(days=tier.get('duration_days', 30))
                )
                sub_dict = subscription.model_dump()
                sub_dict['start_date'] = sub_dict['start_date'].isoformat()
                sub_dict['end_date'] = sub_dict['end_date'].isoformat()
                await db.subscriptions.insert_one(sub_dict)
                
                return {
                    "success": True,
                    "message": "Subscription activated using credits",
                    "credits_used": credits_to_apply,
                    "amount_paid": 0
                }
            
            amount_paise = int(final_amount * 100)
            order_data = {
                "amount": amount_paise,
                "currency": currency,
                "payment_capture": 1
            }
            razor_order = razorpay_client.order.create(data=order_data)
            
            # Create transaction record
            transaction = PaymentTransaction(
                user_id=user.id,
                amount=final_amount,
                currency=currency,
                payment_gateway='razorpay',
                gateway_order_id=razor_order['id'],
                status='pending',
                metadata={
                    "tier_id": tier_id,
                    "payment_type": tier['payment_type'],
                    "original_amount": original_amount,
                    "credits_applied": credits_to_apply,
                    "points_to_deduct": points_to_deduct
                }
            )
            trans_dict = transaction.model_dump()
            trans_dict['created_at'] = trans_dict['created_at'].isoformat()
            await db.payment_transactions.insert_one(trans_dict)
            
            return {
                "order_id": razor_order['id'],
                "amount": final_amount,
                "original_amount": original_amount,
                "credits_applied": credits_to_apply,
                "currency": currency,
                "key_id": os.environ.get('RAZORPAY_KEY_ID', 'test_key')
            }
        except Exception as e:
            logger.error(f"Razorpay error: {e}")
            raise HTTPException(status_code=500, detail="Payment gateway error")
    
    elif gateway == 'stripe':
        # Stripe checkout
        try:
            # If final amount is 0 (fully covered by credits), skip payment
            if final_amount <= 0:
                # Deduct points and activate subscription immediately
                await db.users.update_one(
                    {"id": user.id},
                    {"$inc": {"total_points": -points_to_deduct}}
                )
                
                # Create subscription record
                subscription = Subscription(
                    user_id=user.id,
                    tier_id=tier_id,
                    status='active',
                    start_date=datetime.now(timezone.utc),
                    end_date=datetime.now(timezone.utc) + timedelta(days=tier.get('duration_days', 30))
                )
                sub_dict = subscription.model_dump()
                sub_dict['start_date'] = sub_dict['start_date'].isoformat()
                sub_dict['end_date'] = sub_dict['end_date'].isoformat()
                await db.subscriptions.insert_one(sub_dict)
                
                return {
                    "success": True,
                    "message": "Subscription activated using credits",
                    "credits_used": credits_to_apply,
                    "amount_paid": 0
                }
            
            body = await request.json()
            origin_url = body.get('origin_url', str(request.base_url))
            
            success_url = f"{origin_url}payment-success?session_id={{CHECKOUT_SESSION_ID}}"
            cancel_url = f"{origin_url}pricing"
            
            stripe_api_key = os.environ.get('STRIPE_API_KEY', 'sk_test_emergent')
            webhook_url = f"{origin_url}api/webhook/stripe"
            stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
            
            # Build checkout request based on payment type
            if tier['payment_type'] == 'one-time':
                checkout_request = CheckoutSessionRequest(
                    amount=final_amount,
                    currency=currency.lower(),
                    success_url=success_url,
                    cancel_url=cancel_url,
                    metadata={
                        "tier_id": tier_id,
                        "user_id": user.id,
                        "payment_type": "one-time",
                        "original_amount": str(original_amount),
                        "credits_applied": str(credits_to_apply),
                        "points_to_deduct": str(points_to_deduct)
                    }
                )
            else:
                # Note: For recurring payments, credits can't be applied to subscription price
                # We'll apply credits as a one-time discount instead
                checkout_request = CheckoutSessionRequest(
                    amount=final_amount if final_amount > 0 else original_amount,
                    currency=currency.lower(),
                    success_url=success_url,
                    cancel_url=cancel_url,
                    metadata={
                        "tier_id": tier_id,
                        "user_id": user.id,
                        "payment_type": "recurring",
                        "stripe_price_id": tier['stripe_price_id'],
                        "original_amount": str(original_amount),
                        "credits_applied": str(credits_to_apply),
                        "points_to_deduct": str(points_to_deduct)
                    }
                )
            
            session = await stripe_checkout.create_checkout_session(checkout_request)
            
            # Create transaction record
            transaction = PaymentTransaction(
                user_id=user.id,
                amount=final_amount,
                currency=currency,
                payment_gateway='stripe',
                session_id=session.session_id,
                status='pending',
                metadata={
                    "tier_id": tier_id,
                    "payment_type": tier['payment_type'],
                    "original_amount": original_amount,
                    "credits_applied": credits_to_apply,
                    "points_to_deduct": points_to_deduct
                }
            )
            trans_dict = transaction.model_dump()
            trans_dict['created_at'] = trans_dict['created_at'].isoformat()
            await db.payment_transactions.insert_one(trans_dict)
            
            return {"url": session.url, "session_id": session.session_id}
        except Exception as e:
            logger.error(f"Stripe error: {e}")
            raise HTTPException(status_code=500, detail="Payment gateway error")


@api_router.post("/payments/razorpay/verify")
async def verify_razorpay_payment(request: Request, user: User = Depends(require_auth)):
    """Verify Razorpay payment signature"""
    try:
        data = await request.json()
        
        # Verify signature
        params_dict = {
            'razorpay_order_id': data['razorpay_order_id'],
            'razorpay_payment_id': data['razorpay_payment_id'],
            'razorpay_signature': data['razorpay_signature']
        }
        
        razorpay_client.utility.verify_payment_signature(params_dict)
        
        # Get transaction
        transaction = await db.payment_transactions.find_one({
            "gateway_order_id": data['razorpay_order_id'],
            "user_id": user.id
        })
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Update transaction status
        await db.payment_transactions.update_one(
            {"id": transaction['id']},
            {"$set": {
                "status": "completed",
                "gateway_payment_id": data['razorpay_payment_id']
            }}
        )
        
        # Deduct points if credits were applied
        points_to_deduct = transaction['metadata'].get('points_to_deduct', 0)
        if points_to_deduct > 0:
            await db.users.update_one(
                {"id": user.id},
                {"$inc": {"total_points": -points_to_deduct}}
            )
        
        # Create subscription
        tier_id = transaction['metadata'].get('tier_id')
        if tier_id:
            tier = await db.subscription_tiers.find_one({"id": tier_id})
            if tier:
                payment_type = transaction['metadata'].get('payment_type', 'recurring')
                duration_days = tier.get('duration_days', 30)
                
                subscription = Subscription(
                    user_id=user.id,
                    tier_id=tier_id,
                    amount=transaction['amount'],
                    currency=transaction['currency'],
                    payment_gateway='razorpay',
                    payment_type=payment_type,
                    status='active',
                    starts_at=datetime.now(timezone.utc),
                    ends_at=datetime.now(timezone.utc) + timedelta(days=duration_days),
                    auto_renew=(payment_type == 'recurring')
                )
                sub_dict = subscription.model_dump()
                sub_dict['created_at'] = sub_dict['created_at'].isoformat()
                sub_dict['starts_at'] = sub_dict['starts_at'].isoformat()
                sub_dict['ends_at'] = sub_dict['ends_at'].isoformat()
                await db.subscriptions.insert_one(sub_dict)
                
                # Update user membership
                await db.users.update_one({"id": user.id}, {"$set": {"membership_tier": "paid"}})
        
        return {"status": "success", "message": "Payment verified successfully"}
        
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    except Exception as e:
        logger.error(f"Razorpay verification error: {e}")
        raise HTTPException(status_code=500, detail="Payment verification failed")


@api_router.get("/payments/status/{session_id}")
async def check_payment_status(session_id: str, user: User = Depends(require_auth)):
    """Check Stripe payment status"""
    try:
        stripe_api_key = os.environ.get('STRIPE_API_KEY', 'sk_test_emergent')
        webhook_url = f"{os.environ.get('BACKEND_URL', '')}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
        
        status = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction and create subscription
        transaction = await db.payment_transactions.find_one({"session_id": session_id, "user_id": user.id})
        if transaction and transaction['status'] == 'pending' and status.payment_status == 'paid':
            await db.payment_transactions.update_one(
                {"id": transaction['id']},
                {"$set": {"status": "completed"}}
            )
            
            # Deduct points if credits were applied
            points_to_deduct = transaction['metadata'].get('points_to_deduct', 0)
            if points_to_deduct > 0:
                await db.users.update_one(
                    {"id": user.id},
                    {"$inc": {"total_points": -points_to_deduct}}
                )
            
            # Create subscription
            tier_id = transaction['metadata'].get('tier_id')
            if tier_id:
                tier = await db.subscription_tiers.find_one({"id": tier_id})
                if tier:
                    payment_type = transaction['metadata'].get('payment_type', 'recurring')
                    duration_days = tier.get('duration_days', 30)
                    
                    subscription = Subscription(
                        user_id=user.id,
                        tier_id=tier_id,
                        amount=transaction['amount'],
                        currency=transaction['currency'],
                        payment_gateway='stripe',
                        payment_type=payment_type,
                        status='active',
                        starts_at=datetime.now(timezone.utc),
                        ends_at=datetime.now(timezone.utc) + timedelta(days=duration_days),
                        auto_renew=(payment_type == 'recurring')
                    )
                    sub_dict = subscription.model_dump()
                    sub_dict['created_at'] = sub_dict['created_at'].isoformat()
                    sub_dict['starts_at'] = sub_dict['starts_at'].isoformat()
                    sub_dict['ends_at'] = sub_dict['ends_at'].isoformat()
                    await db.subscriptions.insert_one(sub_dict)
                    
                    # Update user membership
                    await db.users.update_one({"id": user.id}, {"$set": {"membership_tier": "paid"}})
        
        return status
    except Exception as e:
        logger.error(f"Payment status error: {e}")
        raise HTTPException(status_code=500, detail="Error checking payment status")

@api_router.post("/webhook/razorpay")
async def razorpay_webhook(request: Request):
    """Handle Razorpay webhooks"""
    payload = await request.body()
    signature = request.headers.get('X-Razorpay-Signature', '')
    
    try:
        razorpay_client.utility.verify_webhook_signature(
            payload.decode(),
            signature,
            os.environ.get('RAZORPAY_WEBHOOK_SECRET', '')
        )
    except Exception as e:
        logger.error(f"Webhook verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Process webhook
    data = await request.json()
    logger.info(f"Razorpay webhook: {data}")
    
    return {"status": "processed"}

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    payload = await request.body()
    signature = request.headers.get('Stripe-Signature', '')
    
    try:
        stripe_api_key = os.environ.get('STRIPE_API_KEY', 'sk_test_emergent')
        webhook_url = f"{os.environ.get('BACKEND_URL', '')}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
        
        webhook_response = await stripe_checkout.handle_webhook(payload, signature)
        logger.info(f"Stripe webhook: {webhook_response}")
        
        return {"status": "processed"}
    except Exception as e:
        logger.error(f"Stripe webhook error: {e}")
        raise HTTPException(status_code=400, detail="Webhook processing failed")

# ==================== SPACE ENDPOINTS ====================

@api_router.get("/space-groups")
async def get_space_groups():
    """Get all space groups"""
    groups = await db.space_groups.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return groups

@api_router.get("/spaces")
async def get_spaces(space_group_id: Optional[str] = None, user: User = Depends(require_auth)):
    """Get all spaces or by group - filtered by visibility and user membership"""
    query = {"space_group_id": space_group_id} if space_group_id else {}
    spaces = await db.spaces.find(query, {"_id": 0}).sort("order", 1).to_list(100)
    
    # Get total community member count for auto-join spaces
    total_members = await db.users.count_documents({"archived": {"$ne": True}})
    
    # Filter based on visibility and enrich with membership info
    visible_spaces = []
    for space in spaces:
        # Check if user is admin
        is_admin = user.role == 'admin'
        
        # Get user membership
        membership = await db.space_memberships.find_one({
            "space_id": space['id'],
            "user_id": user.id
        }, {"_id": 0})
        
        # Admins are always considered members
        is_member = is_admin or bool(membership)
        
        # Determine visibility
        if space.get('visibility') == 'secret':
            # Secret spaces only visible if member or admin
            if not is_member:
                continue
        
        space['is_member'] = is_member
        space['membership_status'] = membership.get('status') if membership else None
        space['membership_role'] = membership.get('role') if membership else None
        
        # Check for pending join requests
        if not is_member:
            pending_request = await db.join_requests.find_one({
                "user_id": user.id,
                "space_id": space['id'],
                "status": "pending"
            }, {"_id": 0})
            space['has_pending_request'] = bool(pending_request)
            space['pending_request_id'] = pending_request.get('id') if pending_request else None
        else:
            space['has_pending_request'] = False
            space['pending_request_id'] = None
        
        # For auto-join spaces, show total community member count
        if space.get('auto_join'):
            space['member_count'] = total_members
        
        visible_spaces.append(space)
    
    return visible_spaces

@api_router.post("/spaces/{space_id}/join")
async def join_space(space_id: str, user: User = Depends(require_auth)):
    """Join a space"""
    space = await db.spaces.find_one({"id": space_id}, {"_id": 0})
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    # Check if already a member
    existing = await db.space_memberships.find_one({
        "space_id": space_id,
        "user_id": user.id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already a member or pending")
    
    # Check payment requirement
    if space.get('requires_payment') and user.membership_tier != 'paid':
        raise HTTPException(status_code=403, detail="This space requires a paid membership")
    
    # Determine status based on visibility
    status = "pending" if space.get('visibility') == 'private' else "member"
    
    # Create membership
    membership = SpaceMembership(
        space_id=space_id,
        user_id=user.id,
        status=status
    )
    
    membership_dict = membership.model_dump()
    membership_dict['joined_at'] = membership_dict['joined_at'].isoformat()
    await db.space_memberships.insert_one(membership_dict)
    
    # If it's a join request (private space), notify admins and managers
    if status == "pending":
        # Notify global admins (except the requester themselves)
        admins = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(100)
        for admin in admins:
            if admin['id'] != user.id:  # Don't notify yourself
                await create_notification(
                    user_id=admin['id'],
                    notif_type="join_request",
                    title="New join request",
                    message=f"{user.name} wants to join {space.get('name', 'a space')}",
                    related_entity_id=space_id,
                    related_entity_type="space",
                    actor_id=user.id,
                    actor_name=user.name,
                    send_email=False
                )
        
        # Notify space managers (except the requester themselves)
        managers = await db.space_memberships.find({
            "space_id": space_id,
            "role": "manager"
        }, {"_id": 0, "user_id": 1}).to_list(100)
        for manager in managers:
            if manager['user_id'] != user.id and manager['user_id'] not in [admin['id'] for admin in admins]:  # Don't notify yourself and don't duplicate for admin-managers
                await create_notification(
                    user_id=manager['user_id'],
                    notif_type="join_request",
                    title="New join request",
                    message=f"{user.name} wants to join {space.get('name', 'a space')}",
                    related_entity_id=space_id,
                    related_entity_type="space",
                    actor_id=user.id,
                    actor_name=user.name,
                    send_email=False
                )
    
    # Update member count if approved
    if status == "member":
        await db.spaces.update_one({"id": space_id}, {"$inc": {"member_count": 1}})
        
        # Award 1 point for joining a space
        await award_points(
            user_id=user.id,
            points=1,
            action_type="join_space",
            related_entity_type="space",
            related_entity_id=space_id,
            description=f"Joined space: {space.get('name', 'Unknown')}"
        )
    
    return {"message": f"{'Join request sent' if status == 'pending' else 'Joined space successfully'}", "status": status}

@api_router.post("/spaces/{space_id}/leave")
async def leave_space(space_id: str, user: User = Depends(require_auth)):
    """Leave a space"""
    result = await db.space_memberships.delete_one({
        "space_id": space_id,
        "user_id": user.id,
        "status": "member"
    })
    
    if result.deleted_count > 0:
        await db.spaces.update_one({"id": space_id}, {"$inc": {"member_count": -1}})
        return {"message": "Left space successfully"}
    
    raise HTTPException(status_code=404, detail="Not a member of this space")

@api_router.get("/spaces/{space_id}/members")
async def get_space_members(space_id: str, user: User = Depends(require_auth)):
    """Get members of a space"""
    memberships = await db.space_memberships.find({
        "space_id": space_id,
        "status": "member"
    }, {"_id": 0}).to_list(1000)
    
    return {"members": memberships, "count": len(memberships)}

@api_router.put("/admin/spaces/{space_id}/configure")
async def configure_space(space_id: str, request: Request, user: User = Depends(require_auth)):
    """Configure space settings (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can configure spaces")
    
    data = await request.json()
    
    update_fields = {}
    if 'visibility' in data:
        if data['visibility'] not in ['public', 'private', 'secret']:
            raise HTTPException(status_code=400, detail="Invalid visibility value")
        update_fields['visibility'] = data['visibility']
    
    if 'requires_payment' in data:
        update_fields['requires_payment'] = data['requires_payment']
    
    if 'description' in data:
        update_fields['description'] = data['description']
    
    if update_fields:
        await db.spaces.update_one({"id": space_id}, {"$set": update_fields})
    
    return {"message": "Space configured successfully"}

@api_router.get("/spaces/{space_id}/posts")
async def get_space_posts(space_id: str, skip: int = 0, limit: int = 20):
    """Get posts in a space, with pinned posts shown first"""
    # Get all posts for this space
    all_posts = await db.posts.find({"space_id": space_id}, {"_id": 0}).sort("created_at", -1).to_list(None)
    
    # Separate pinned and regular posts
    pinned_posts = [p for p in all_posts if p.get('is_pinned', False)]
    regular_posts = [p for p in all_posts if not p.get('is_pinned', False)]
    
    # Combine: pinned first, then regular posts
    posts = pinned_posts + regular_posts
    
    # Apply pagination
    posts = posts[skip:skip+limit]
    
    # Enrich with author info
    for post in posts:
        author = await db.users.find_one({"id": post['author_id']}, {"_id": 0, "name": 1, "picture": 1, "badges": 1})
        post['author'] = author
    
    return posts

@api_router.post("/posts")
async def create_post(request: Request, user: User = Depends(require_auth)):
    """Create a new post"""
    data = await request.json()
    
    # Check if space allows member posts
    space = await db.spaces.find_one({"id": data['space_id']}, {"_id": 0})
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    # Check if user is blocked from this space (handles both hard and soft blocks)
    block_status = await get_effective_block_status(user.id, data['space_id'])
    if block_status['is_blocked']:
        if block_status['block_type'] == 'soft':
            raise HTTPException(status_code=403, detail="You are temporarily blocked from posting in this space")
        else:
            raise HTTPException(status_code=403, detail="You are blocked from posting in this space")
    
    # Check if user is a member - required for ALL spaces (public, private, secret)
    # Public spaces allow viewing without membership, but posting requires membership
    is_member = await is_space_member(user, data['space_id'])
    if not is_member:
        if space.get('visibility') == 'public':
            raise HTTPException(status_code=403, detail="Please join this space to create posts")
        else:
            raise HTTPException(status_code=403, detail="You must be a member to post in this space")
    
    # If space doesn't allow member posts, only admins/managers can post
    if not space.get('allow_member_posts', True):
        is_authorized = await is_space_manager_or_admin(user, data['space_id'])
        if not is_authorized:
            raise HTTPException(status_code=403, detail="Only admins and managers can create posts in this space")
    
    post = Post(
        space_id=data['space_id'],
        author_id=user.id,
        title=data.get('title'),
        content=data['content'],
        images=data.get('images', []),
        links=data.get('links', []),
        tags=data.get('tags', [])
    )
    
    post_dict = post.model_dump()
    post_dict['created_at'] = post_dict['created_at'].isoformat()
    post_dict['updated_at'] = post_dict['updated_at'].isoformat()
    await db.posts.insert_one(post_dict)
    
    # Award points for creating a post (3 points)
    await track_activity_streak(user.id)
    await award_points(
        user_id=user.id,
        points=3,
        action_type="post",
        related_entity_type="post",
        related_entity_id=post.id,
        description=f"Created a post in {space.get('name', 'space')}"
    )
    
    return post

@api_router.post("/posts/{post_id}/react")
async def react_to_post(post_id: str, emoji: str, user: User = Depends(require_auth)):
    """Add reaction to post"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if user is blocked from this space (handles both hard and soft blocks)
    block_status = await get_effective_block_status(user.id, post['space_id'])
    if block_status['is_blocked']:
        if block_status['block_type'] == 'soft':
            raise HTTPException(status_code=403, detail="You are temporarily blocked from reacting in this space")
        else:
            raise HTTPException(status_code=403, detail="You are blocked from reacting in this space")
    
    # Check if user is a member - required for ALL spaces
    space = await db.spaces.find_one({"id": post['space_id']}, {"_id": 0})
    is_member = await is_space_member(user, post['space_id'])
    if not is_member:
        if space and space.get('visibility') == 'public':
            raise HTTPException(status_code=403, detail="Please join this space to react to posts")
        else:
            raise HTTPException(status_code=403, detail="You must be a member to react in this space")
    
    reactions = post.get('reactions', {})
    if emoji not in reactions:
        reactions[emoji] = []
    
    # Check if this is adding or removing a reaction
    is_adding = user.id not in reactions[emoji]
    
    if user.id in reactions[emoji]:
        reactions[emoji].remove(user.id)
    else:
        reactions[emoji].append(user.id)
    
    await db.posts.update_one({"id": post_id}, {"$set": {"reactions": reactions}})
    
    # Award or deduct points based on action
    if is_adding:
        # Track activity streak
        await track_activity_streak(user.id)
        
        # Award 1 point to the person liking
        await award_points(
            user_id=user.id,
            points=1,
            action_type="like",
            related_entity_type="post",
            related_entity_id=post_id,
            related_user_id=post['author_id'],
            description="Liked a post"
        )
        
        # Award 1 point to the post author (if not self-like)
        if user.id != post['author_id']:
            await award_points(
                user_id=post['author_id'],
                points=1,
                action_type="receive_like",
                related_entity_type="post",
                related_entity_id=post_id,
                related_user_id=user.id,
                description="Received a like on post"
            )
            
            # Create notification for post author
            await create_notification(
                user_id=post['author_id'],
                notif_type="post_like",
                title="Someone liked your post",
                message=f"{user.name} liked your post",
                related_entity_id=post_id,
                related_entity_type="post",
                actor_id=user.id,
                actor_name=user.name,
                send_email=False
            )
    else:
        # Removing reaction - deduct points
        # Deduct 1 point from the person who is unreacting
        await db.users.update_one(
            {"id": user.id},
            {"$inc": {"total_points": -1}}
        )
        
        # Deduct 1 point from post author (if not self-like)
        if user.id != post['author_id']:
            await db.users.update_one(
                {"id": post['author_id']},
                {"$inc": {"total_points": -1}}
            )
    
    return {"reactions": reactions}



@api_router.put("/spaces/{space_id}/posts/{post_id}/pin")
async def pin_post(space_id: str, post_id: str, user: User = Depends(require_auth)):
    """Pin a post in a space (Admin/Manager only). Only one post can be pinned per space."""
    # Check if user is admin or space manager
    is_authorized = await is_space_manager_or_admin(user, space_id)
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Only admins and space managers can pin posts")
    
    # Verify post exists and belongs to this space
    post = await db.posts.find_one({"id": post_id, "space_id": space_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found in this space")
    
    # Unpin any currently pinned post in this space
    await db.posts.update_many(
        {"space_id": space_id, "is_pinned": True},
        {"$set": {"is_pinned": False}}
    )
    
    # Pin this post
    await db.posts.update_one(
        {"id": post_id},
        {"$set": {"is_pinned": True}}
    )
    
    # Update space's pinned_post_id
    await db.spaces.update_one(
        {"id": space_id},
        {"$set": {"pinned_post_id": post_id}}
    )
    
    logger.info(f"Post {post_id} pinned in space {space_id} by {user.name}")
    
    return {"message": "Post pinned successfully", "post_id": post_id}

@api_router.delete("/spaces/{space_id}/posts/{post_id}/pin")
async def unpin_post(space_id: str, post_id: str, user: User = Depends(require_auth)):
    """Unpin a post in a space (Admin/Manager only)"""
    # Check if user is admin or space manager
    is_authorized = await is_space_manager_or_admin(user, space_id)
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Only admins and space managers can unpin posts")
    
    # Verify post exists and belongs to this space
    post = await db.posts.find_one({"id": post_id, "space_id": space_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found in this space")
    
    # Unpin the post
    await db.posts.update_one(
        {"id": post_id},
        {"$set": {"is_pinned": False}}
    )
    
    # Clear space's pinned_post_id if this was the pinned post
    space = await db.spaces.find_one({"id": space_id}, {"_id": 0, "pinned_post_id": 1})
    if space and space.get('pinned_post_id') == post_id:
        await db.spaces.update_one(
            {"id": space_id},
            {"$set": {"pinned_post_id": None}}
        )
    
    logger.info(f"Post {post_id} unpinned in space {space_id} by {user.name}")
    
    return {"message": "Post unpinned successfully", "post_id": post_id}



@api_router.delete("/spaces/{space_id}/posts/{post_id}")
async def delete_post(space_id: str, post_id: str, user: User = Depends(require_auth)):
    """Delete a post (Post author, Admin, or Space Manager only)"""
    # Get the post
    post = await db.posts.find_one({"id": post_id, "space_id": space_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found in this space")
    
    # Check authorization: post author OR admin OR space manager
    is_author = post['author_id'] == user.id
    is_admin = user.role == 'admin'
    is_manager = await is_space_manager_or_admin(user, space_id)
    
    if not (is_author or is_admin or is_manager):
        raise HTTPException(status_code=403, detail="Only the post author, admins, or space managers can delete this post")
    
    # Delete all comments associated with this post
    comments_result = await db.comments.delete_many({"post_id": post_id})
    
    # If this post is pinned, unpin it from the space
    if post.get('is_pinned', False):
        await db.spaces.update_one(
            {"id": space_id, "pinned_post_id": post_id},
            {"$set": {"pinned_post_id": None}}
        )
    
    # Delete the post
    await db.posts.delete_one({"id": post_id})
    
    logger.info(f"Post {post_id} deleted by {user.name} (Author: {is_author}, Admin: {is_admin}, Manager: {is_manager})")
    
    return {
        "message": "Post deleted successfully",
        "post_id": post_id,
        "comments_deleted": comments_result.deleted_count
    }

@api_router.post("/posts/{post_id}/comments")
async def add_comment(post_id: str, request: Request, user: User = Depends(require_auth)):
    """Add comment to post"""
    data = await request.json()
    
    # Get post to find space_id
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if user is blocked from this space (handles both hard and soft blocks)
    block_status = await get_effective_block_status(user.id, post['space_id'])
    if block_status['is_blocked']:
        if block_status['block_type'] == 'soft':
            raise HTTPException(status_code=403, detail="You are temporarily blocked from commenting in this space")
        else:
            raise HTTPException(status_code=403, detail="You are blocked from commenting in this space")
    
    # Check if user is a member - required for ALL spaces
    space = await db.spaces.find_one({"id": post['space_id']}, {"_id": 0})
    is_member = await is_space_member(user, post['space_id'])
    if not is_member:
        if space and space.get('visibility') == 'public':
            raise HTTPException(status_code=403, detail="Please join this space to comment")
        else:
            raise HTTPException(status_code=403, detail="You must be a member to comment in this space")
    
    comment = Comment(
        post_id=post_id,
        author_id=user.id,
        content=data['content'],
        parent_comment_id=data.get('parent_comment_id')
    )
    
    comment_dict = comment.model_dump()
    comment_dict['created_at'] = comment_dict['created_at'].isoformat()
    await db.comments.insert_one(comment_dict)
    
    # Update comment count
    await db.posts.update_one({"id": post_id}, {"$inc": {"comment_count": 1}})
    
    # Award points for commenting (2 points to commenter)
    await track_activity_streak(user.id)
    await award_points(
        user_id=user.id,
        points=2,
        action_type="comment",
        related_entity_type="post",
        related_entity_id=post_id,
        related_user_id=post['author_id'],
        description="Commented on a post"
    )
    
    # Award 2 points to the post author (if not self-comment)
    if user.id != post['author_id']:
        await award_points(
            user_id=post['author_id'],
            points=2,
            action_type="receive_comment",
            related_entity_type="post",
            related_entity_id=post_id,
            related_user_id=user.id,
            description="Received a comment on post"
        )
        
        # Notify post author
        await create_notification(
            user_id=post['author_id'],
            notif_type="comment",
            title="New comment on your post",
            message=f"{user.name} commented on your post",
            related_entity_id=post_id,
            related_entity_type="post",
            actor_id=user.id,
            actor_name=user.name,
            send_email=False
        )
    
    # If replying to another comment, notify that commenter
    if comment.parent_comment_id:
        parent_comment = await db.comments.find_one({"id": comment.parent_comment_id})
        if parent_comment and parent_comment['author_id'] != user.id:
            await create_notification(
                user_id=parent_comment['author_id'],
                notif_type="comment_reply",
                title="Someone replied to your comment",
                message=f"{user.name} replied to your comment",
                related_entity_id=post_id,
                related_entity_type="post",
                actor_id=user.id,
                actor_name=user.name,
                send_email=False
            )
    
    return comment

@api_router.get("/posts/{post_id}/comments")
async def get_comments(post_id: str):
    """Get comments for a post"""
    comments = await db.comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", 1).to_list(100)
    
    # Enrich with author info
    for comment in comments:
        author = await db.users.find_one({"id": comment['author_id']}, {"_id": 0, "name": 1, "picture": 1})
        comment['author'] = author
    
    return comments


@api_router.post("/comments/{comment_id}/react")
async def react_to_comment(comment_id: str, emoji: str, user: User = Depends(require_auth)):
    """Add reaction to comment"""
    comment = await db.comments.find_one({"id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Get the post to find space_id for membership check
    post = await db.posts.find_one({"id": comment['post_id']}, {"_id": 0, "space_id": 1, "author_id": 1})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if user is blocked from this space
    block_status = await get_effective_block_status(user.id, post['space_id'])
    if block_status['is_blocked']:
        if block_status['block_type'] == 'soft':
            raise HTTPException(status_code=403, detail="You are temporarily blocked from reacting in this space")
        else:
            raise HTTPException(status_code=403, detail="You are blocked from reacting in this space")
    
    # Check if user is a member
    space = await db.spaces.find_one({"id": post['space_id']}, {"_id": 0})
    is_member = await is_space_member(user, post['space_id'])
    if not is_member:
        if space and space.get('visibility') == 'public':
            raise HTTPException(status_code=403, detail="Please join this space to react to comments")
        else:
            raise HTTPException(status_code=403, detail="You must be a member to react in this space")
    
    reactions = comment.get('reactions', {})
    if emoji not in reactions:
        reactions[emoji] = []
    
    # Check if this is adding or removing a reaction
    is_adding = user.id not in reactions[emoji]
    
    if user.id in reactions[emoji]:
        reactions[emoji].remove(user.id)
    else:
        reactions[emoji].append(user.id)
    
    await db.comments.update_one({"id": comment_id}, {"$set": {"reactions": reactions}})
    
    # Award or deduct points based on action
    if is_adding:
        # Track activity streak
        await track_activity_streak(user.id)
        
        # Award 0.5 points to the person reacting
        await award_points(
            user_id=user.id,
            points=0.5,
            action_type="like_comment",
            related_entity_type="comment",
            related_entity_id=comment_id,
            related_user_id=comment['author_id'],
            description="Reacted to a comment"
        )
        
        # Award 0.5 points to the comment author (if not self-reaction)
        if user.id != comment['author_id']:
            await award_points(
                user_id=comment['author_id'],
                points=0.5,
                action_type="receive_like_comment",
                related_entity_type="comment",
                related_entity_id=comment_id,
                related_user_id=user.id,
                description="Received a reaction on comment"
            )
    else:
        # Removing reaction - deduct points
        # Deduct 0.5 points from the person who is unreacting
        await db.users.update_one(
            {"id": user.id},
            {"$inc": {"total_points": -0.5}}
        )
        
        # Deduct 0.5 points from comment author (if not self-reaction)
        if user.id != comment['author_id']:
            await db.users.update_one(
                {"id": comment['author_id']},
                {"$inc": {"total_points": -0.5}}
            )
    
    return {"reactions": reactions}


# ==================== EVENT ENDPOINTS ====================

@api_router.get("/events")
async def get_events(upcoming: bool = True):
    """Get events"""
    now = datetime.now(timezone.utc).isoformat()
    query = {"start_time": {"$gte": now}} if upcoming else {}
    events = await db.events.find(query, {"_id": 0}).sort("start_time", 1).to_list(100)
    return events

@api_router.post("/events")
async def create_event(request: Request, user: User = Depends(require_auth)):
    """Create new event"""
    data = await request.json()
    
    event = Event(
        title=data['title'],
        description=data.get('description'),
        space_id=data.get('space_id'),
        host_id=user.id,
        event_type=data.get('event_type', 'live_session'),
        start_time=datetime.fromisoformat(data['start_time']),
        end_time=datetime.fromisoformat(data['end_time']),
        tags=data.get('tags', []),
        requires_membership=data.get('requires_membership', False)
    )
    
    event_dict = event.model_dump()
    event_dict['created_at'] = event_dict['created_at'].isoformat()
    event_dict['start_time'] = event_dict['start_time'].isoformat()
    event_dict['end_time'] = event_dict['end_time'].isoformat()
    await db.events.insert_one(event_dict)
    
    return event

@api_router.put("/events/{event_id}")
async def update_event(event_id: str, request: Request, user: User = Depends(require_auth)):
    """Update event (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    event = await db.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    data = await request.json()
    
    update_fields = {}
    if 'title' in data:
        update_fields['title'] = data['title']
    if 'description' in data:
        update_fields['description'] = data['description']
    if 'event_type' in data:
        update_fields['event_type'] = data['event_type']
    if 'start_time' in data:
        update_fields['start_time'] = datetime.fromisoformat(data['start_time']).isoformat()
    if 'end_time' in data:
        update_fields['end_time'] = datetime.fromisoformat(data['end_time']).isoformat()
    if 'requires_membership' in data:
        update_fields['requires_membership'] = data['requires_membership']
    if 'tags' in data:
        update_fields['tags'] = data['tags']
    
    if update_fields:
        await db.events.update_one({"id": event_id}, {"$set": update_fields})
    
    return {"message": "Event updated successfully"}

@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, user: User = Depends(require_auth)):
    """Delete event (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.events.delete_one({"id": event_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return {"message": "Event deleted successfully"}

@api_router.post("/events/{event_id}/rsvp")
async def rsvp_event(event_id: str, user: User = Depends(require_auth)):
    """RSVP to event"""
    event = await db.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    rsvp_list = event.get('rsvp_list', [])
    if user.id in rsvp_list:
        rsvp_list.remove(user.id)
    else:
        rsvp_list.append(user.id)
    
    await db.events.update_one({"id": event_id}, {"$set": {"rsvp_list": rsvp_list}})
    return {"rsvp_list": rsvp_list}

# ==================== MEMBER ENDPOINTS ====================

@api_router.get("/members")
async def get_members(search: Optional[str] = None, skip: int = 0, limit: int = 50):
    """Get member directory"""
    query = {}
    if search:
        query = {"$or": [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"skills": {"$regex": search, "$options": "i"}}
        ]}
    
    members = await db.users.find(query, {"_id": 0, "password_hash": 0}).skip(skip).limit(limit).to_list(limit)
    return members

@api_router.get("/members/{user_id}")
async def get_member(user_id: str):
    """Get member profile"""
    member = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member

@api_router.put("/members/profile")
async def update_profile(request: Request, user: User = Depends(require_auth)):
    """Update user profile"""
    data = await request.json()
    
    update_fields = {}
    allowed_fields = ['name', 'bio', 'skills', 'learning_goals', 'location', 'linkedin', 'picture']
    for field in allowed_fields:
        if field in data:
            update_fields[field] = data[field]
    
    if update_fields:
        # Get current user data before update
        current_user = await db.users.find_one({"id": user.id}, {"_id": 0})
        
        # Check if profile was incomplete before (just checking for picture)
        was_incomplete = not current_user.get('picture')
        
        await db.users.update_one({"id": user.id}, {"$set": update_fields})
        
        # Check if profile is now complete (after update) - has picture
        updated_user = await db.users.find_one({"id": user.id}, {"_id": 0})
        is_now_complete = updated_user.get('picture')
        
        # Award 5 points for completing profile (one-time only)
        if was_incomplete and is_now_complete:
            # Check if already awarded
            existing_award = await db.point_transactions.find_one({
                "user_id": user.id,
                "action_type": "complete_profile"
            })
            
            if not existing_award:
                await award_points(
                    user_id=user.id,
                    points=5,
                    action_type="complete_profile",
                    description="Completed profile (uploaded profile picture)"
                )
    
    return {"message": "Profile updated"}

@api_router.put("/admin/members/{user_id}/archive")
async def archive_member(user_id: str, user: User = Depends(require_auth)):
    """Archive a member (soft delete - admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can archive members")
    
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot archive yourself")
    
    member = await db.users.find_one({"id": user_id})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Set archived flag and prevent login
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"archived": True, "archived_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Delete all active sessions
    await db.user_sessions.delete_many({"user_id": user_id})
    
    return {"message": f"Member {member.get('name')} archived successfully"}

@api_router.put("/admin/members/{user_id}/unarchive")
async def unarchive_member(user_id: str, user: User = Depends(require_auth)):
    """Unarchive a member (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can unarchive members")
    
    member = await db.users.find_one({"id": user_id})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"archived": False}, "$unset": {"archived_at": ""}}
    )
    
    return {"message": f"Member {member.get('name')} restored successfully"}

@api_router.delete("/admin/members/{user_id}")
async def delete_member(user_id: str, user: User = Depends(require_auth)):
    """Permanently delete a member (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can delete members")
    
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    member = await db.users.find_one({"id": user_id})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Delete user and all related data
    await db.users.delete_one({"id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    
    return {"message": f"Member {member.get('name')} permanently deleted"}


@api_router.post("/admin/cleanup-all-users")
async def cleanup_all_users(request: Request):
    """
    ONE-TIME CLEANUP ENDPOINT: Delete all users and user-related data
    Keeps: Spaces, Space Groups, Subscription Tiers, Platform Settings, Levels
    
    This endpoint should be called ONCE to clean up test data.
    Requires a secret confirmation token for safety.
    """
    try:
        data = await request.json()
        confirmation = data.get('confirmation')
        
        # Safety check - require exact confirmation phrase
        if confirmation != "DELETE_ALL_USERS_PERMANENTLY":
            raise HTTPException(
                status_code=400, 
                detail="Invalid confirmation. Required: 'DELETE_ALL_USERS_PERMANENTLY'"
            )
        
        # Get counts before deletion
        users_count = await db.users.count_documents({})
        
        if users_count == 0:
            return {
                "message": "No users to delete",
                "deleted_counts": {
                    "users": 0,
                    "sessions": 0,
                    "posts": 0,
                    "comments": 0,
                    "memberships": 0,
                    "messages": 0,
                    "notifications": 0,
                    "point_transactions": 0,
                    "join_requests": 0,
                    "invite_tokens": 0
                }
            }
        
        logger.info(f"🧹 CLEANUP: Starting deletion of {users_count} users and related data")
        
        # Delete all user-related data
        result_users = await db.users.delete_many({})
        result_sessions = await db.user_sessions.delete_many({})
        result_posts = await db.posts.delete_many({})
        result_comments = await db.comments.delete_many({})
        result_memberships = await db.space_memberships.delete_many({})
        result_messages = await db.direct_messages.delete_many({})
        result_notifications = await db.notifications.delete_many({})
        result_transactions = await db.point_transactions.delete_many({})
        result_join_requests = await db.join_requests.delete_many({})
        result_invites = await db.invite_tokens.delete_many({})
        result_groups = await db.groups.delete_many({})
        result_group_messages = await db.group_messages.delete_many({})
        result_prefs = await db.user_messaging_preferences.delete_many({})
        
        # Reset space member counts to 0
        await db.spaces.update_many({}, {"$set": {"member_count": 0}})
        
        deleted_counts = {
            "users": result_users.deleted_count,
            "sessions": result_sessions.deleted_count,
            "posts": result_posts.deleted_count,
            "comments": result_comments.deleted_count,
            "memberships": result_memberships.deleted_count,
            "messages": result_messages.deleted_count,
            "notifications": result_notifications.deleted_count,
            "point_transactions": result_transactions.deleted_count,
            "join_requests": result_join_requests.deleted_count,
            "invite_tokens": result_invites.deleted_count,
            "groups": result_groups.deleted_count,
            "group_messages": result_group_messages.deleted_count,
            "user_preferences": result_prefs.deleted_count
        }
        
        logger.info(f"✅ CLEANUP: Successfully deleted all user data. Details: {deleted_counts}")
        
        return {
            "message": "✅ All users and user-related data deleted successfully",
            "deleted_counts": deleted_counts,
            "preserved": [
                "Spaces",
                "Space Groups",
                "Subscription Tiers",
                "Platform Settings",
                "Levels"
            ],
            "note": "The next user to register will automatically become admin"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ CLEANUP: Error during cleanup: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")

@api_router.post("/admin/promote-user-to-admin")
async def promote_user_to_admin(request: Request):
    """
    ONE-TIME ENDPOINT: Promote a specific user to admin
    Use this when you need to manually create the first admin
    """
    try:
        data = await request.json()
        email = data.get('email')
        confirmation = data.get('confirmation')
        
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")
        
        if confirmation != "MAKE_ME_ADMIN":
            raise HTTPException(status_code=400, detail="Invalid confirmation. Required: 'MAKE_ME_ADMIN'")
        
        # Find user by email
        user = await db.users.find_one({"email": email})
        if not user:
            raise HTTPException(status_code=404, detail=f"User with email {email} not found")
        
        # Check current role
        current_role = user.get('role', 'learner')
        if current_role == 'admin':
            return {
                "message": f"User {user.get('name')} is already an admin",
                "email": email,
                "role": "admin"
            }
        
        # Update to admin
        await db.users.update_one(
            {"email": email},
            {"$set": {"role": "admin"}}
        )
        
        logger.info(f"🔑 User {email} promoted to admin")
        
        return {
            "message": f"✅ User {user.get('name')} promoted to admin successfully",
            "email": email,
            "previous_role": current_role,
            "new_role": "admin",
            "note": "Please log out and log back in for changes to take effect"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error promoting user: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Promotion failed: {str(e)}")

        raise
    except Exception as e:
        logger.error(f"❌ CLEANUP: Error during cleanup: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")


# ==================== DM ENDPOINTS ====================

@api_router.get("/dms")
async def get_dms(user: User = Depends(require_auth)):
    """Get DM conversations"""
    dms = await db.direct_messages.find({
        "$or": [{"sender_id": user.id}, {"receiver_id": user.id}]
    }, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    
    return dms

@api_router.post("/dms")
async def send_dm(request: Request, user: User = Depends(require_auth)):
    """Send direct message"""
    data = await request.json()
    
    dm = DirectMessage(
        sender_id=user.id,
        receiver_id=data['receiver_id'],
        content=data['content']
    )
    
    dm_dict = dm.model_dump()
    dm_dict['created_at'] = dm_dict['created_at'].isoformat()
    await db.direct_messages.insert_one(dm_dict)
    
    # Create notification
    notification = Notification(
        user_id=data['receiver_id'],
        type='dm',
        title='New Message',
        message=f"{user.name} sent you a message",
        link=f"/dms/{user.id}"
    )
    notif_dict = notification.model_dump()
    notif_dict['created_at'] = notif_dict['created_at'].isoformat()
    await db.notifications.insert_one(notif_dict)
    
    return dm

# ==================== NOTIFICATION ENDPOINTS ====================

# ==================== FEATURE REQUEST ENDPOINTS ====================

@api_router.get("/feature-requests")
async def get_feature_requests(sort: str = "votes"):
    """Get feature requests"""
    sort_field = "vote_count" if sort == "votes" else "created_at"
    requests = await db.feature_requests.find({}, {"_id": 0}).sort(sort_field, -1).to_list(100)
    
    # Enrich with author info
    for req in requests:
        author = await db.users.find_one({"id": req['author_id']}, {"_id": 0, "name": 1, "picture": 1})
        req['author'] = author
    
    return requests

@api_router.post("/feature-requests")
async def create_feature_request(request: Request, user: User = Depends(require_auth)):
    """Create feature request"""
    data = await request.json()
    
    feature_req = FeatureRequest(
        author_id=user.id,
        title=data['title'],
        description=data['description'],
        category=data.get('category', 'general')
    )
    
    req_dict = feature_req.model_dump()
    req_dict['created_at'] = req_dict['created_at'].isoformat()
    await db.feature_requests.insert_one(req_dict)
    
    return feature_req

@api_router.post("/feature-requests/{request_id}/vote")
async def vote_feature_request(request_id: str, user: User = Depends(require_auth)):
    """Vote on feature request"""
    feature_req = await db.feature_requests.find_one({"id": request_id})
    if not feature_req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    votes = feature_req.get('votes', [])
    if user.id in votes:
        votes.remove(user.id)
    else:
        votes.append(user.id)
    
    await db.feature_requests.update_one(
        {"id": request_id},
        {"$set": {"votes": votes, "vote_count": len(votes)}}
    )
    
    return {"votes": len(votes)}

# ==================== ADMIN ENDPOINTS ====================

@api_router.post("/admin/space-groups")
async def create_space_group(request: Request, user: User = Depends(require_auth)):
    """Create space group (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    data = await request.json()
    group = SpaceGroup(**data)
    
    group_dict = group.model_dump()
    group_dict['created_at'] = group_dict['created_at'].isoformat()
    await db.space_groups.insert_one(group_dict)
    
    return group

@api_router.put("/admin/space-groups/{group_id}")
async def update_space_group(group_id: str, request: Request, user: User = Depends(require_auth)):
    """Update space group (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    data = await request.json()
    update_fields = {}
    
    if 'name' in data:
        update_fields['name'] = data['name']
    if 'description' in data:
        update_fields['description'] = data['description']
    if 'icon' in data:
        update_fields['icon'] = data['icon']
    if 'order' in data:
        update_fields['order'] = data['order']
    
    if update_fields:
        result = await db.space_groups.update_one({"id": group_id}, {"$set": update_fields})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Space group not found")
    
    return {"message": "Space group updated successfully"}

@api_router.delete("/admin/space-groups/{group_id}")
async def delete_space_group(group_id: str, user: User = Depends(require_auth)):
    """Delete space group (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if any spaces belong to this group
    spaces_count = await db.spaces.count_documents({"space_group_id": group_id})
    if spaces_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete space group with {spaces_count} spaces. Move or delete spaces first.")
    
    result = await db.space_groups.delete_one({"id": group_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Space group not found")
    
    return {"message": "Space group deleted successfully"}

@api_router.post("/admin/spaces")
async def create_space(request: Request, user: User = Depends(require_auth)):
    """Create space (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    data = await request.json()
    space = Space(**data)
    
    space_dict = space.model_dump()
    space_dict['created_at'] = space_dict['created_at'].isoformat()
    await db.spaces.insert_one(space_dict)
    
    return space

@api_router.put("/admin/spaces/{space_id}")
async def update_space(space_id: str, request: Request, user: User = Depends(require_auth)):
    """Update space (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    data = await request.json()
    update_fields = {}
    
    allowed_fields = ['name', 'description', 'space_group_id', 'icon', 'order', 'is_pinned', 
                      'visibility', 'requires_payment', 'subscription_tier_id', 'auto_join',
                      'space_type', 'allow_member_posts', 'welcome_title', 'welcome_message']
    
    for field in allowed_fields:
        if field in data:
            update_fields[field] = data[field]
    
    if 'visibility' in update_fields and update_fields['visibility'] not in ['public', 'private', 'secret']:
        raise HTTPException(status_code=400, detail="Invalid visibility value")
    
    if update_fields:
        result = await db.spaces.update_one({"id": space_id}, {"$set": update_fields})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Space not found")
    
    return {"message": "Space updated successfully"}

@api_router.delete("/admin/spaces/{space_id}")
async def delete_space(space_id: str, user: User = Depends(require_auth)):
    """Delete space (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if space has posts
    posts_count = await db.posts.count_documents({"space_id": space_id})
    if posts_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete space with {posts_count} posts. Archive or delete posts first.")
    
    # Delete space memberships
    await db.space_memberships.delete_many({"space_id": space_id})
    
    # Delete space
    result = await db.spaces.delete_one({"id": space_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Space not found")
    
    return {"message": "Space deleted successfully"}

@api_router.get("/admin/analytics")
async def get_analytics(user: User = Depends(require_auth)):
    """Get platform analytics (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_users = await db.users.count_documents({})
    paid_users = await db.users.count_documents({"membership_tier": "paid"})
    total_posts = await db.posts.count_documents({})
    total_events = await db.events.count_documents({})
    
    return {
        "total_users": total_users,
        "paid_users": paid_users,
        "total_posts": total_posts,
        "total_events": total_events
    }

# Join Request Management
@api_router.post("/spaces/{space_id}/join-request")
async def create_join_request(space_id: str, request: Request, user: User = Depends(require_auth)):
    """Create a join request for a private space"""
    # Check if space exists and is private
    space = await db.spaces.find_one({"id": space_id}, {"_id": 0})
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    if space.get('visibility') not in ['private', 'secret']:
        raise HTTPException(status_code=400, detail="This space doesn't require join requests")
    
    # Check if already a member
    existing_membership = await db.space_memberships.find_one({"user_id": user.id, "space_id": space_id})
    if existing_membership:
        raise HTTPException(status_code=400, detail="You are already a member of this space")
    
    # Check if request already exists
    existing_request = await db.join_requests.find_one({
        "user_id": user.id, 
        "space_id": space_id,
        "status": "pending"
    })
    if existing_request:
        raise HTTPException(status_code=400, detail="You already have a pending request for this space")
    
    data = await request.json()
    join_request = JoinRequest(
        user_id=user.id,
        space_id=space_id,
        message=data.get('message')
    )
    
    request_dict = join_request.model_dump()
    request_dict['created_at'] = request_dict['created_at'].isoformat()
    await db.join_requests.insert_one(request_dict)
    
    return join_request

@api_router.get("/spaces/{space_id}/join-requests")
async def get_join_requests(space_id: str, user: User = Depends(require_auth)):
    """Get all join requests for a space (admin/manager only)"""
    # Check if user is admin or manager
    is_authorized = await is_space_manager_or_admin(user, space_id)
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Admin or manager access required")
    
    requests = await db.join_requests.find({"space_id": space_id}, {"_id": 0}).to_list(100)
    
    # Enrich with user data
    for req in requests:
        user_data = await db.users.find_one({"id": req['user_id']}, {"_id": 0, "password_hash": 0})
        req['user'] = user_data
    
    return requests

@api_router.get("/my-join-requests")
async def get_my_join_requests(user: User = Depends(require_auth)):
    """Get current user's join requests"""
    requests = await db.join_requests.find({"user_id": user.id}, {"_id": 0}).to_list(100)
    
    # Enrich with space data
    for req in requests:
        space_data = await db.spaces.find_one({"id": req['space_id']}, {"_id": 0})
        req['space'] = space_data
    
    return requests

@api_router.put("/join-requests/{request_id}/approve")
async def approve_join_request(request_id: str, user: User = Depends(require_auth)):
    """Approve a join request (admin/manager only)"""
    join_request = await db.join_requests.find_one({"id": request_id}, {"_id": 0})
    if not join_request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Check if user is admin or manager for this space
    is_authorized = await is_space_manager_or_admin(user, join_request['space_id'])
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Admin or manager access required")
    
    if join_request['status'] != 'pending':
        raise HTTPException(status_code=400, detail="Request already processed")
    
    # Update request status
    await db.join_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "approved",
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": user.id
        }}
    )
    
    # Create space membership
    membership = SpaceMembership(
        user_id=join_request['user_id'],
        space_id=join_request['space_id'],
        role="member"
    )
    membership_dict = membership.model_dump()
    membership_dict['joined_at'] = membership_dict['joined_at'].isoformat()
    await db.space_memberships.insert_one(membership_dict)
    
    # Update space member count
    await db.spaces.update_one(
        {"id": join_request['space_id']},
        {"$inc": {"member_count": 1}}
    )
    
    # Award 1 point for joining a space (after approval)
    space = await db.spaces.find_one({"id": join_request['space_id']}, {"_id": 0})
    await award_points(
        user_id=join_request['user_id'],
        points=1,
        action_type="join_space",
        related_entity_type="space",
        related_entity_id=join_request['space_id'],
        description=f"Joined space: {space.get('name', 'Unknown') if space else 'Unknown'}"
    )
    
    # Notify requester that they were approved
    await create_notification(
        user_id=join_request['user_id'],
        notif_type="join_approved",
        title="Join request approved!",
        message=f"Your request to join {space.get('name', 'the space') if space else 'the space'} has been approved",
        related_entity_id=join_request['space_id'],
        related_entity_type="space",
        actor_id=user.id,
        actor_name=user.name,
        send_email=False
    )
    
    # Send approval email
    try:
        requester = await db.users.find_one({"id": join_request['user_id']}, {"_id": 0})
        if requester:
            email_template = get_email_template(
                "join_approved",
                user_name=requester.get('name', 'there'),
                space_name=space.get('name', 'the space') if space else 'the space',
                space_url=f"{os.environ.get('FRONTEND_URL', '')}/space/{join_request['space_id']}"
            )
            await send_email(
                to_email=requester.get('email'),
                subject=email_template["subject"],
                html_content=email_template["html"],
                user_id=join_request['user_id'],
                check_preferences=True
            )
    except Exception as e:
        logger.error(f"Failed to send join approval email: {e}")
    
    return {"message": "Request approved"}

@api_router.put("/join-requests/{request_id}/reject")
async def reject_join_request(request_id: str, user: User = Depends(require_auth)):
    """Reject a join request (admin/manager only)"""
    join_request = await db.join_requests.find_one({"id": request_id}, {"_id": 0})
    if not join_request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Check if user is admin or manager for this space
    is_authorized = await is_space_manager_or_admin(user, join_request['space_id'])
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Admin or manager access required")
    
    if join_request['status'] != 'pending':
        raise HTTPException(status_code=400, detail="Request already processed")
    
    # Update request status
    await db.join_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "rejected",
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": user.id
        }}
    )
    
    # Notify requester that they were rejected
    space = await db.spaces.find_one({"id": join_request['space_id']}, {"_id": 0})
    await create_notification(
        user_id=join_request['user_id'],
        notif_type="join_rejected",
        title="Join request declined",
        message=f"Your request to join {space.get('name', 'the space') if space else 'the space'} was declined",
        related_entity_id=join_request['space_id'],
        related_entity_type="space",
        actor_id=user.id,
        actor_name=user.name,
        send_email=False
    )
    
    # Send rejection email
    try:
        requester = await db.users.find_one({"id": join_request['user_id']}, {"_id": 0})
        if requester:
            email_template = get_email_template(
                "join_rejected",
                user_name=requester.get('name', 'there'),
                space_name=space.get('name', 'the space') if space else 'the space',
                spaces_url=f"{os.environ.get('FRONTEND_URL', '')}/dashboard"
            )
            await send_email(
                to_email=requester.get('email'),
                subject=email_template["subject"],
                html_content=email_template["html"],
                user_id=join_request['user_id'],
                check_preferences=True
            )
    except Exception as e:
        logger.error(f"Failed to send join rejection email: {e}")
    
    return {"message": "Request rejected"}

@api_router.delete("/join-requests/{request_id}")
async def cancel_join_request(request_id: str, user: User = Depends(require_auth)):
    """Cancel a join request (user's own request)"""
    join_request = await db.join_requests.find_one({"id": request_id}, {"_id": 0})
    if not join_request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if join_request['user_id'] != user.id:
        raise HTTPException(status_code=403, detail="You can only cancel your own requests")
    
    if join_request['status'] != 'pending':
        raise HTTPException(status_code=400, detail="Can only cancel pending requests")
    
    await db.join_requests.delete_one({"id": request_id})
    
    return {"message": "Request cancelled"}


# ==================== MEMBER MANAGEMENT ENDPOINTS ====================


# ==================== SPACE INVITES (FOR SECRET SPACES) ====================

@api_router.post("/spaces/{space_id}/invites")
async def create_space_invite(space_id: str, request: Request, user: User = Depends(require_auth)):
    """Create an invite link for a space (admin/manager only)"""
    # Check if user is admin or manager for this space
    is_authorized = await is_space_manager_or_admin(user, space_id)
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Admin or manager access required")
    
    data = await request.json()
    max_uses = data.get('max_uses')  # None = unlimited
    expires_at = data.get('expires_at')  # ISO datetime string
    
    # Parse expiry if provided
    expiry_datetime = None
    if expires_at:
        try:
            expiry_datetime = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid expires_at format: {str(e)}")
    
    # Create invite
    invite = SpaceInvite(
        space_id=space_id,
        created_by=user.id,
        max_uses=max_uses,
        expires_at=expiry_datetime
    )
    
    invite_dict = invite.model_dump()
    if invite_dict.get('expires_at'):
        invite_dict['expires_at'] = invite_dict['expires_at'].isoformat()
    invite_dict['created_at'] = invite_dict['created_at'].isoformat()
    
    await db.space_invites.insert_one(invite_dict)
    
    return {
        "invite_code": invite.invite_code,
        "invite_link": f"/join/{invite.invite_code}",
        "max_uses": invite.max_uses,
        "expires_at": invite.expires_at
    }

@api_router.get("/spaces/{space_id}/invites")
async def get_space_invites(space_id: str, user: User = Depends(require_auth)):
    """Get all invites for a space (admin/manager only)"""
    # Check if user is admin or manager for this space
    is_authorized = await is_space_manager_or_admin(user, space_id)
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Admin or manager access required")
    
    invites = await db.space_invites.find({
        "space_id": space_id,
        "is_active": True
    }, {"_id": 0}).to_list(100)
    
    return invites

@api_router.delete("/invites/{invite_code}")
async def deactivate_invite(invite_code: str, user: User = Depends(require_auth)):
    """Deactivate an invite (admin/manager only)"""
    invite = await db.space_invites.find_one({"invite_code": invite_code}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    # Check if user is admin or manager for this space
    is_authorized = await is_space_manager_or_admin(user, invite['space_id'])
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Admin or manager access required")
    
    await db.space_invites.update_one(
        {"invite_code": invite_code},
        {"$set": {"is_active": False}}
    )
    
    return {"message": "Invite deactivated"}

@api_router.post("/join/{invite_code}")
async def join_via_invite(invite_code: str, user: User = Depends(require_auth)):
    """Join a space using an invite code"""
    invite = await db.space_invites.find_one({"invite_code": invite_code}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    
    if not invite.get('is_active'):
        raise HTTPException(status_code=400, detail="This invite has been deactivated")
    
    # Check if expired
    if invite.get('expires_at'):
        expiry = datetime.fromisoformat(invite['expires_at'].replace('Z', '+00:00'))
        if datetime.now(timezone.utc) > expiry:
            raise HTTPException(status_code=400, detail="This invite has expired")
    
    # Check max uses
    if invite.get('max_uses') is not None:
        if invite.get('uses_count', 0) >= invite['max_uses']:
            raise HTTPException(status_code=400, detail="This invite has reached its usage limit")
    
    space_id = invite['space_id']
    
    # Check if already a member
    existing = await db.space_memberships.find_one({
        "user_id": user.id,
        "space_id": space_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="You are already a member of this space")
    
    # Add user to space
    membership = SpaceMembership(
        user_id=user.id,
        space_id=space_id,
        role="member",
        status="member"
    )
    
    membership_dict = membership.model_dump()
    membership_dict['joined_at'] = membership_dict['joined_at'].isoformat()
    await db.space_memberships.insert_one(membership_dict)
    
    # Increment member count and invite uses
    await db.spaces.update_one({"id": space_id}, {"$inc": {"member_count": 1}})
    await db.space_invites.update_one(
        {"invite_code": invite_code},
        {"$inc": {"uses_count": 1}}
    )
    
    # Get space info
    space = await db.spaces.find_one({"id": space_id}, {"_id": 0})
    
    return {
        "message": "Successfully joined space via invite",
        "space": space
    }


@api_router.get("/spaces/{space_id}/members-detailed")
async def get_space_members_detailed(space_id: str, user: User = Depends(require_auth)):
    """Get detailed member list for a space (admin/manager only)"""
    # Check if user is admin or manager
    is_authorized = await is_space_manager_or_admin(user, space_id)
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Admin or manager access required")
    
    memberships = await db.space_memberships.find({
        "space_id": space_id
    }, {"_id": 0}).to_list(1000)
    
    # Enrich with user data
    for membership in memberships:
        user_data = await db.users.find_one(
            {"id": membership['user_id']}, 
            {"_id": 0, "id": 1, "name": 1, "email": 1, "picture": 1, "role": 1, "badges": 1}
        )
        membership['user'] = user_data
    
    return {"members": memberships, "count": len(memberships)}

@api_router.delete("/spaces/{space_id}/members/{user_id}")
async def remove_space_member(space_id: str, user_id: str, user: User = Depends(require_auth)):
    """Remove a member from a space (admin/manager only)"""
    # Check if user is admin or manager
    is_authorized = await is_space_manager_or_admin(user, space_id)
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Admin or manager access required")
    
    # Can't remove yourself if you're the only manager
    if user_id == user.id:
        managers_count = await db.space_memberships.count_documents({
            "space_id": space_id,
            "role": "manager"
        })
        if managers_count == 1:
            raise HTTPException(status_code=400, detail="Cannot remove yourself as the only manager")
    
    result = await db.space_memberships.delete_one({
        "space_id": space_id,
        "user_id": user_id
    })
    
    if result.deleted_count > 0:
        await db.spaces.update_one({"id": space_id}, {"$inc": {"member_count": -1}})
        return {"message": "Member removed successfully"}
    
    raise HTTPException(status_code=404, detail="Member not found")

@api_router.put("/spaces/{space_id}/members/{user_id}/block")
async def block_space_member(space_id: str, user_id: str, request: Request, user: User = Depends(require_auth)):
    """Block a member from a space (admin/manager only) - supports both hard and soft blocks"""
    # Check if user is admin or manager
    is_authorized = await is_space_manager_or_admin(user, space_id)
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Admin or manager access required")
    
    # Can't block yourself
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    
    # Get block parameters from request body
    data = await request.json()
    block_type = data.get('block_type', 'hard')  # 'hard' or 'soft'
    expires_at = data.get('expires_at')  # ISO datetime string for expiry (optional)
    
    # Validate block_type
    if block_type not in ['hard', 'soft']:
        raise HTTPException(status_code=400, detail="Invalid block_type. Must be 'hard' or 'soft'")
    
    # Parse expiry date if provided
    block_expires_at = None
    if expires_at:
        try:
            block_expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid expires_at format: {str(e)}")
    
    result = await db.space_memberships.update_one(
        {
            "space_id": space_id,
            "user_id": user_id
        },
        {
            "$set": {
                "status": "blocked",
                "blocked_at": datetime.now(timezone.utc).isoformat(),
                "blocked_by": user.id,
                "block_type": block_type,
                "block_expires_at": block_expires_at.isoformat() if block_expires_at else None
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    
    block_msg = f"Member {block_type}-blocked successfully"
    if block_expires_at:
        block_msg += f" until {block_expires_at.strftime('%Y-%m-%d %H:%M:%S %Z')}"
    return {"message": block_msg}


# ==================== LEADERBOARD & LEVELS MANAGEMENT ====================

@api_router.get("/levels")
async def get_levels():
    """Get all levels"""
    levels = await db.levels.find({}, {"_id": 0}).sort("level_number", 1).to_list(100)
    return levels

@api_router.post("/admin/levels")
async def create_level(request: Request, user: User = Depends(require_auth)):
    """Create a new level (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    data = await request.json()
    
    # Check if level number already exists
    existing = await db.levels.find_one({"level_number": data['level_number']})
    if existing:
        raise HTTPException(status_code=400, detail="Level number already exists")
    
    level = Level(
        level_number=data['level_number'],
        level_name=data.get('level_name', f"Level {data['level_number']}"),
        points_required=data['points_required']
    )
    
    level_dict = level.model_dump()
    level_dict['created_at'] = level_dict['created_at'].isoformat()
    await db.levels.insert_one(level_dict)
    
    return level

@api_router.put("/admin/levels/{level_id}")
async def update_level(level_id: str, request: Request, user: User = Depends(require_auth)):
    """Update a level (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    data = await request.json()
    
    update_fields = {}
    if 'level_name' in data:
        update_fields['level_name'] = data['level_name']
    if 'points_required' in data:
        update_fields['points_required'] = data['points_required']
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.levels.update_one({"id": level_id}, {"$set": update_fields})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Level not found")
    
    # Recalculate all users' levels after updating level points
    users = await db.users.find({}, {"_id": 0, "id": 1}).to_list(10000)
    for u in users:
        await update_user_level(u['id'])
    
    return {"message": "Level updated successfully"}

@api_router.delete("/admin/levels/{level_id}")
async def delete_level(level_id: str, user: User = Depends(require_auth)):
    """Delete a level (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.levels.delete_one({"id": level_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Level not found")
    
    return {"message": "Level deleted successfully"}

@api_router.get("/leaderboard")
async def get_leaderboard(time_filter: str = "all", user: User = Depends(require_auth)):
    """
    Get leaderboard with time filter
    time_filter: 'week' (7 days), 'month' (30 days), or 'all'
    """
    # Calculate date threshold
    now = datetime.now(timezone.utc)
    date_threshold = None
    
    if time_filter == "week":
        date_threshold = now - timedelta(days=7)
    elif time_filter == "month":
        date_threshold = now - timedelta(days=30)
    
    # Get all users
    all_users = await db.users.find(
        {"archived": False},
        {"_id": 0, "id": 1, "name": 1, "picture": 1, "total_points": 1, "current_level": 1}
    ).to_list(10000)
    
    # Calculate points for the time period
    leaderboard_data = []
    for u in all_users:
        if time_filter == "all":
            # Use total_points directly
            points = u.get('total_points', 0)
        else:
            # Calculate points from transactions in the time period
            query = {"user_id": u['id']}
            if date_threshold:
                query["created_at"] = {"$gte": date_threshold.isoformat()}
            
            transactions = await db.point_transactions.find(query, {"_id": 0, "points": 1}).to_list(10000)
            points = sum(t['points'] for t in transactions)
        
        if points > 0:  # Only include users with points
            leaderboard_data.append({
                "user_id": u['id'],
                "name": u['name'],
                "picture": u.get('picture'),
                "points": points,
                "level": u.get('current_level', 1)
            })
    
    # Sort by points descending
    leaderboard_data.sort(key=lambda x: x['points'], reverse=True)
    
    # Add rank
    for idx, entry in enumerate(leaderboard_data):
        entry['rank'] = idx + 1
    
    # Get current user's stats
    current_user_stats = await get_user_leaderboard_stats(user.id)
    
    # Find current user's position in this filtered leaderboard
    current_user_entry = next((entry for entry in leaderboard_data if entry['user_id'] == user.id), None)
    
    return {
        "leaderboard": leaderboard_data[:100],  # Top 100
        "current_user": current_user_stats,
        "current_user_rank": current_user_entry['rank'] if current_user_entry else None,
        "time_filter": time_filter
    }

@api_router.get("/users/{user_id}/points-history")
async def get_user_points_history(user_id: str, user: User = Depends(require_auth)):
    """Get detailed points history for a user (admin only or own profile)"""
    if user.role != 'admin' and user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    transactions = await db.point_transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    return transactions

@api_router.post("/admin/seed-levels")
async def seed_default_levels(user: User = Depends(require_auth)):
    """Seed default 10 levels (admin only, one-time setup)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if levels already exist
    existing_count = await db.levels.count_documents({})
    if existing_count > 0:
        raise HTTPException(status_code=400, detail="Levels already exist. Delete all levels first if you want to reseed.")
    
    # Default levels based on screenshot
    default_levels = [
        {"level_number": 1, "level_name": "Newbie", "points_required": 0},
        {"level_number": 2, "level_name": "Beginner", "points_required": 10},
        {"level_number": 3, "level_name": "Learner", "points_required": 20},
        {"level_number": 4, "level_name": "Explorer", "points_required": 40},
        {"level_number": 5, "level_name": "Contributor", "points_required": 80},
        {"level_number": 6, "level_name": "Regular", "points_required": 160},
        {"level_number": 7, "level_name": "Expert", "points_required": 320},
        {"level_number": 8, "level_name": "Master", "points_required": 640},
        {"level_number": 9, "level_name": "Legend", "points_required": 1280},
        {"level_number": 10, "level_name": "Champion", "points_required": 2560},
    ]
    
    for level_data in default_levels:
        level = Level(**level_data)
        level_dict = level.model_dump()
        level_dict['created_at'] = level_dict['created_at'].isoformat()
        await db.levels.insert_one(level_dict)
    
    return {"message": "Default 10 levels created successfully", "count": len(default_levels)}

@api_router.put("/spaces/{space_id}/members/{user_id}/unblock")
async def unblock_space_member(space_id: str, user_id: str, user: User = Depends(require_auth)):
    """Unblock a member from a space (admin/manager only)"""
    # Check if user is admin or manager
    is_authorized = await is_space_manager_or_admin(user, space_id)
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Admin or manager access required")
    
    result = await db.space_memberships.update_one(
        {
            "space_id": space_id,
            "user_id": user_id,
            "status": "blocked"
        },
        {
            "$set": {
                "status": "member",
                "blocked_at": None,
                "blocked_by": None,
                "block_type": "hard",  # Reset to default
                "block_expires_at": None
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Blocked member not found")
    
    return {"message": "Member unblocked successfully"}

@api_router.put("/spaces/{space_id}/members/{user_id}/promote")
async def promote_to_manager(space_id: str, user_id: str, user: User = Depends(require_auth)):
    """Promote a member to manager (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can promote members to manager")
    
    # Check if user is a member
    membership = await db.space_memberships.find_one({
        "space_id": space_id,
        "user_id": user_id,
        "status": "member"
    })
    
    if not membership:
        raise HTTPException(status_code=404, detail="Member not found")
    
    result = await db.space_memberships.update_one(
        {
            "space_id": space_id,
            "user_id": user_id
        },
        {
            "$set": {"role": "manager"}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    
    return {"message": "Member promoted to manager successfully"}

@api_router.put("/spaces/{space_id}/members/{user_id}/demote")
async def demote_from_manager(space_id: str, user_id: str, user: User = Depends(require_auth)):
    """Demote a manager to regular member (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can demote managers")
    
    # Can't demote yourself if you're the only manager
    if user_id == user.id:
        managers_count = await db.space_memberships.count_documents({
            "space_id": space_id,
            "role": "manager"
        })
        if managers_count == 1:
            raise HTTPException(status_code=400, detail="Cannot demote yourself as the only manager")
    
    result = await db.space_memberships.update_one(
        {
            "space_id": space_id,
            "user_id": user_id,
            "role": "manager"
        },
        {
            "$set": {"role": "member"}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Manager not found")
    
    return {"message": "Manager demoted to member successfully"}



# ==================== USER ROLE MANAGEMENT (ADMIN ONLY) ====================

@api_router.put("/users/{user_id}/promote-to-admin")
async def promote_user_to_admin(user_id: str, user: User = Depends(require_auth)):
    """Promote a user to global admin (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can promote users to admin")
    
    # Can't promote yourself (you're already admin)
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="You are already an admin")
    
    # Check if user exists
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if target_user.get('role') == 'admin':
        raise HTTPException(status_code=400, detail="User is already an admin")
    
    # Update user role
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"role": "admin"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User promoted to admin successfully"}

@api_router.put("/users/{user_id}/demote-from-admin")
async def demote_user_from_admin(user_id: str, user: User = Depends(require_auth)):
    """Demote an admin to regular learner (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can demote admins")
    
    # Can't demote yourself
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot demote yourself")
    
    # Check how many admins exist
    admin_count = await db.users.count_documents({"role": "admin"})
    if admin_count <= 1:
        raise HTTPException(status_code=400, detail="Cannot demote the last admin")
    
    # Check if user exists and is admin
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if target_user.get('role') != 'admin':
        raise HTTPException(status_code=400, detail="User is not an admin")
    
    # Update user role
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"role": "learner"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Admin demoted to learner successfully"}

@api_router.get("/users/all")
async def get_all_users(user: User = Depends(require_auth)):
    """Get all users (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users


@api_router.get("/users/{user_id}/managed-spaces")
async def get_user_managed_spaces(user_id: str, user: User = Depends(require_auth)):
    """Get all spaces where user is a manager (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Find all spaces where this user is a manager
    memberships = await db.space_memberships.find({
        "user_id": user_id,
        "role": "manager"
    }, {"_id": 0}).to_list(100)
    
    # Enrich with space names
    space_ids = [m['space_id'] for m in memberships]
    managed_spaces = []
    
    for space_id in space_ids:
        space = await db.spaces.find_one({"id": space_id}, {"_id": 0, "id": 1, "name": 1})
        if space:
            managed_spaces.append(space)
    


# ==================== BLOCK EXPIRY MANAGEMENT ====================

@api_router.post("/admin/process-expired-blocks")
async def process_expired_blocks(user: User = Depends(require_auth)):
    """Process all expired blocks and auto-unblock them (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Find all blocked memberships with expiry dates
    blocked_memberships = await db.space_memberships.find({
        "status": "blocked",
        "block_expires_at": {"$ne": None}
    }, {"_id": 0}).to_list(1000)
    
    unblocked_count = 0
    now = datetime.now(timezone.utc)
    
    for membership in blocked_memberships:
        block_expires_at = membership.get('block_expires_at')
        if block_expires_at:
            try:
                expiry_datetime = datetime.fromisoformat(block_expires_at.replace('Z', '+00:00'))
                
                # If block has expired, auto-unblock
                if now >= expiry_datetime:
                    await db.space_memberships.update_one(
                        {
                            "user_id": membership['user_id'],
                            "space_id": membership['space_id']
                        },
                        {
                            "$set": {
                                "status": "member",
                                "blocked_at": None,
                                "blocked_by": None,
                                "block_type": "hard",
                                "block_expires_at": None
                            }
                        }
                    )
                    unblocked_count += 1
            except Exception as e:
                logger.error(f"Error processing expired block: {e}")
    
    return {
        "message": f"Processed {len(blocked_memberships)} blocked memberships",
        "unblocked_count": unblocked_count
    }


# ==================== TEAM MEMBER BADGE MANAGEMENT (ADMIN ONLY) ====================

@api_router.put("/users/{user_id}/set-team-member")
async def set_user_team_member_status(user_id: str, request: Request, user: User = Depends(require_auth)):
    """Set or unset team member badge for a user (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can manage team member badges")
    
    data = await request.json()
    is_team_member = data.get('is_team_member', False)
    
    # Check if user exists
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update user team member status
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_team_member": is_team_member}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    action = "granted" if is_team_member else "removed"
    return {"message": f"Team member badge {action} successfully"}


# ==================== CENTRALIZED USER MANAGEMENT WITH MEMBERSHIPS (ADMIN ONLY) ====================

@api_router.get("/users/all-with-memberships")
async def get_all_users_with_memberships(user: User = Depends(require_auth)):
    """Get all users with their space memberships and roles (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get all users (excluding password)
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    
    # For each user, get their space memberships
    for user_obj in users:
        user_id = user_obj['id']
        
        # Get memberships
        memberships = await db.space_memberships.find({
            "user_id": user_id
        }, {"_id": 0}).to_list(100)
        
        # Enrich memberships with space names
        enriched_memberships = []
        for membership in memberships:
            space = await db.spaces.find_one({"id": membership['space_id']}, {"_id": 0, "id": 1, "name": 1})
            if space:
                enriched_memberships.append({
                    "space_id": membership['space_id'],
                    "space_name": space['name'],
                    "role": membership.get('role', 'member'),
                    "status": membership.get('status', 'member'),
                    "joined_at": membership.get('joined_at'),
                    "blocked_at": membership.get('blocked_at'),
                    "block_type": membership.get('block_type', 'hard'),
                    "block_expires_at": membership.get('block_expires_at')
                })
        
        user_obj['memberships'] = enriched_memberships
        
        # Count managed spaces
        manager_count = sum(1 for m in enriched_memberships if m['role'] == 'manager')
        user_obj['managed_spaces_count'] = manager_count
    
    return users


# Subscription Tiers Management
@api_router.get("/subscription-tiers")
async def get_subscription_tiers():
    """Get all subscription tiers"""
    tiers = await db.subscription_tiers.find({"is_active": True}, {"_id": 0}).sort("price", 1).to_list(100)
    return tiers

@api_router.post("/admin/subscription-tiers")
async def create_subscription_tier(request: Request, user: User = Depends(require_auth)):
    """Create subscription tier (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    data = await request.json()
    tier = SubscriptionTier(**data)
    
    tier_dict = tier.model_dump()
    tier_dict['created_at'] = tier_dict['created_at'].isoformat()
    await db.subscription_tiers.insert_one(tier_dict)
    
    return tier

@api_router.put("/admin/subscription-tiers/{tier_id}")
async def update_subscription_tier(tier_id: str, request: Request, user: User = Depends(require_auth)):
    """Update subscription tier (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    data = await request.json()
    update_fields = {}
    
    allowed_fields = ['name', 'description', 'price', 'currency', 'features', 'is_active']
    for field in allowed_fields:
        if field in data:
            update_fields[field] = data[field]
    
    if update_fields:
        result = await db.subscription_tiers.update_one({"id": tier_id}, {"$set": update_fields})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Subscription tier not found")
    
    return {"message": "Subscription tier updated successfully"}

@api_router.delete("/admin/subscription-tiers/{tier_id}")
async def delete_subscription_tier(tier_id: str, user: User = Depends(require_auth)):
    """Delete subscription tier (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if any spaces use this tier
    spaces_count = await db.spaces.count_documents({"subscription_tier_id": tier_id})
    if spaces_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete tier used by {spaces_count} spaces")
    
    result = await db.subscription_tiers.delete_one({"id": tier_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subscription tier not found")
    
    return {"message": "Subscription tier deleted successfully"}



@api_router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str, user: User = Depends(require_auth)):
    """Delete a notification"""
    result = await db.notifications.delete_one({
        "id": notification_id,
        "user_id": user.id  # Only allow users to delete their own notifications
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "success", "message": "Notification deleted"}


# Platform Settings endpoints
@api_router.get("/platform-settings")
async def get_platform_settings_endpoint():
    """Get platform settings (public)"""
    settings = await get_platform_settings()
    # Remove MongoDB _id field for JSON serialization
    if settings and '_id' in settings:
        del settings['_id']
    return settings

@api_router.put("/admin/platform-settings")
async def update_platform_settings(request: Request, user: User = Depends(require_auth)):
    """Update platform settings (admin only)"""
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    data = await request.json()
    
    # Update settings
    update_data = {
        "requires_payment_to_join": data.get('requires_payment_to_join', False),
        "allowed_tier_ids": data.get('allowed_tier_ids', []),
        "community_name": data.get('community_name', 'Community'),
        "primary_color": data.get('primary_color', '#0462CB'),
        "logo": data.get('logo'),  # Base64 encoded logo
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.platform_settings.update_one(
        {"id": "global_settings"},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "Platform settings updated successfully", "settings": update_data}

@api_router.get("/me/subscription-status")
async def get_user_subscription_status(user: User = Depends(require_auth)):
    """Get current user's subscription status"""
    settings = await get_platform_settings()
    has_subscription = await user_has_active_subscription(user.id)
    
    # Get active subscription details if exists
    subscription = None
    if has_subscription:
        sub = await db.subscriptions.find_one({
            "user_id": user.id,
            "status": "active",
            "ends_at": {"$gt": datetime.now(timezone.utc).isoformat()}
        })
        if sub:
            subscription = {
                "tier_id": sub.get('tier_id'),
                "ends_at": sub.get('ends_at'),
                "auto_renew": sub.get('auto_renew', False),
                "payment_type": sub.get('payment_type', 'recurring')
            }
    
    return {
        "requires_payment": settings.get('requires_payment_to_join', False),
        "has_subscription": has_subscription,
        "subscription": subscription,
        "is_admin": user.role == 'admin'
    }



# ==================== ONBOARDING ENDPOINTS ====================

@api_router.get("/me/onboarding-progress")
async def get_user_onboarding_progress(user: User = Depends(require_auth)):
    """Get user's onboarding progress with auto-detection"""
    
    # Check profile picture
    has_profile_picture = bool(user.picture)
    
    # Check profile completion (bio, location, linkedin)
    has_bio = bool(user.bio)
    has_location = bool(user.location)
    has_linkedin = bool(user.linkedin)
    profile_complete = has_bio and has_location and has_linkedin
    
    # Check if user has joined any space (admins auto-join all spaces)
    if user.role == 'admin':
        has_joined_space = True  # Admins are automatically added to all spaces
    else:
        joined_space = await db.space_memberships.find_one({
            "user_id": user.id,
            "status": "member"
        })
        has_joined_space = bool(joined_space)
    
    # Check if user has posted in Introduction space
    intro_space = await db.spaces.find_one({"name": "Introduction"})
    has_intro_post = False
    if intro_space:
        intro_post = await db.posts.find_one({
            "author_id": user.id,
            "space_id": intro_space['id']
        })
        has_intro_post = bool(intro_post)
    
    # Check if user has made any comment
    first_comment = await db.comments.find_one({"author_id": user.id})
    has_commented = bool(first_comment)
    
    # Check if user has reacted to any post
    # Look for any post where the user's ID appears in the reactions
    has_reacted = False
    posts_with_reactions = await db.posts.find({"reactions": {"$exists": True}}).to_list(1000)
    for post in posts_with_reactions:
        reactions = post.get('reactions', {})
        for emoji, user_ids in reactions.items():
            if user.id in user_ids:
                has_reacted = True
                break
        if has_reacted:
            break
    
    steps = [
        {
            "id": "profile_picture",
            "title": "Upload your profile picture",
            "description": "Add a photo to personalize your profile",
            "completed": has_profile_picture,
            "points": 5
        },
        {
            "id": "complete_profile",
            "title": "Complete your profile",
            "description": "Add your bio, location, and LinkedIn",
            "completed": profile_complete,
            "points": 5
        },
        {
            "id": "join_space",
            "title": "Join your first space",
            "description": "Explore and join a community space",
            "completed": has_joined_space,
            "points": 1
        },
        {
            "id": "intro_post",
            "title": "Introduce yourself",
            "description": "Share your introduction in the Introduction space",
            "completed": has_intro_post,
            "points": 3
        },
        {
            "id": "first_comment",
            "title": "Leave your first comment",
            "description": "Engage with the community by commenting",
            "completed": has_commented,
            "points": 2
        },
        {
            "id": "first_reaction",
            "title": "React to a post",
            "description": "Show appreciation with a reaction",
            "completed": has_reacted,
            "points": 1
        }
    ]
    
    completed_count = sum(1 for step in steps if step['completed'])
    total_steps = len(steps)
    progress_percentage = int((completed_count / total_steps) * 100) if total_steps > 0 else 0
    
    return {
        "steps": steps,
        "completed_count": completed_count,
        "total_steps": total_steps,
        "progress_percentage": progress_percentage,
        "is_complete": completed_count == total_steps
    }


# ==================== REFERRAL ENDPOINTS ====================

@api_router.get("/me/referral-code")
async def get_my_referral_code(user: User = Depends(require_auth)):
    """Get or create user's referral code"""
    referral_code = await get_or_create_referral_code(user.id)
    return {"referral_code": referral_code}

@api_router.get("/me/referral-stats")
async def get_my_referral_stats(user: User = Depends(require_auth)):
    """Get user's referral statistics"""
    # Get total referrals
    total_referrals = await db.users.count_documents({"referred_by": user.id})
    
    # Get list of referred users with their info
    referred_users = await db.users.find(
        {"referred_by": user.id},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "created_at": 1, "total_points": 1}
    ).to_list(100)
    
    # Calculate points earned from referrals (50 points per referral)
    REFERRAL_POINTS = 50
    points_earned = total_referrals * REFERRAL_POINTS
    
    # Get user's current total points and calculate available credits
    current_user = await db.users.find_one({"id": user.id}, {"_id": 0, "total_points": 1})
    total_points = current_user.get('total_points', 0)
    
    # Calculate credits in both currencies
    credits_inr = calculate_credits_from_points(total_points, "INR")
    credits_usd = calculate_credits_from_points(total_points, "USD")
    
    return {
        "total_referrals": total_referrals,
        "points_earned_from_referrals": points_earned,
        "total_points": total_points,
        "credits_inr": credits_inr,
        "credits_usd": credits_usd,
        "referred_users": referred_users
    }



# ==================== MESSAGING ENDPOINTS ====================

# Helper function to check messaging permissions
async def can_send_message(sender: User, receiver_id: str) -> tuple[bool, str]:
    """Check if sender can message receiver based on platform and user settings"""
    # Get platform settings
    settings = await db.messaging_settings.find_one({"id": "messaging_settings"})
    if not settings:
        # Default settings if not configured
        settings = {"who_can_initiate": "all"}
    
    who_can_initiate = settings.get("who_can_initiate", "all")
    
    # Check sender's permission based on platform settings
    if who_can_initiate == "admins":
        if sender.role != "admin":
            return False, "Only admins can initiate messages"
    elif who_can_initiate == "paid":
        if sender.membership_tier != "paid" and sender.role != "admin":
            return False, "Only paid members can initiate messages"
    
    # Check receiver's preferences
    receiver_prefs = await db.user_messaging_preferences.find_one({"user_id": receiver_id})
    if receiver_prefs and not receiver_prefs.get("allow_messages", False):
        return False, "This user has disabled receiving messages"
    elif not receiver_prefs:
        # If no preferences set, default is NO (don't allow)
        return False, "This user has not enabled receiving messages"
    
    return True, ""

# WebSocket endpoint for real-time messaging
@app.websocket("/ws/messages/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """WebSocket endpoint for real-time messaging"""
    await ws_manager.connect(user_id, websocket)
    try:
        while True:
            # Keep connection alive and receive messages
            data = await websocket.receive_json()
            # Messages are sent via HTTP POST endpoints
            # This just keeps the connection alive
            logger.info(f"Received websocket data from {user_id}: {data}")
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id)
        logger.info(f"User {user_id} disconnected from websocket")
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        ws_manager.disconnect(user_id)

# Get messaging settings (platform-level)
@api_router.get("/admin/messaging-settings")
async def get_messaging_settings(user: User = Depends(require_auth)):
    """Get platform messaging settings (admin only)"""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.messaging_settings.find_one({"id": "messaging_settings"}, {"_id": 0})
    if not settings:
        # Return default settings
        return {
            "who_can_initiate": "all",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    
    # Convert datetime fields to ISO format
    if 'created_at' in settings and isinstance(settings['created_at'], datetime):
        settings['created_at'] = settings['created_at'].isoformat()
    if 'updated_at' in settings and isinstance(settings['updated_at'], datetime):
        settings['updated_at'] = settings['updated_at'].isoformat()
    
    return settings

# Update messaging settings (platform-level)
@api_router.put("/admin/messaging-settings")
async def update_messaging_settings(request: Request, user: User = Depends(require_auth)):
    """Update platform messaging settings (admin only)"""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    data = await request.json()
    who_can_initiate = data.get("who_can_initiate", "all")
    
    if who_can_initiate not in ["all", "paid", "admins"]:
        raise HTTPException(status_code=400, detail="Invalid who_can_initiate value")
    
    settings = {
        "id": "messaging_settings",
        "who_can_initiate": who_can_initiate,
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.messaging_settings.update_one(
        {"id": "messaging_settings"},
        {"$set": settings},
        upsert=True
    )
    
    return {"status": "success", "settings": settings}

# Get user's messaging preferences
@api_router.get("/me/messaging-preferences")
async def get_my_messaging_preferences(user: User = Depends(require_auth)):
    """Get current user's messaging preferences"""
    prefs = await db.user_messaging_preferences.find_one({"user_id": user.id}, {"_id": 0})
    if not prefs:
        # Return default
        return {
            "user_id": user.id,
            "allow_messages": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    
    # Convert datetime fields
    if 'created_at' in prefs and isinstance(prefs['created_at'], datetime):
        prefs['created_at'] = prefs['created_at'].isoformat()
    if 'updated_at' in prefs and isinstance(prefs['updated_at'], datetime):
        prefs['updated_at'] = prefs['updated_at'].isoformat()
    
    return prefs

# Update user's messaging preferences
@api_router.put("/me/messaging-preferences")
async def update_my_messaging_preferences(request: Request, user: User = Depends(require_auth)):
    """Update current user's messaging preferences"""
    data = await request.json()
    allow_messages = data.get("allow_messages", False)
    
    prefs = {
        "user_id": user.id,
        "allow_messages": bool(allow_messages),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.user_messaging_preferences.update_one(
        {"user_id": user.id},
        {"$set": prefs, "$setOnInsert": {"created_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    
    return {"status": "success", "allow_messages": allow_messages}


@api_router.put("/me/email-preferences")
async def update_email_preferences(request: Request, user: User = Depends(require_auth)):
    """Update current user's email notification preferences"""
    data = await request.json()
    email_notifications_enabled = data.get("email_notifications_enabled", True)
    
    await db.users.update_one(
        {"id": user.id},
        {"$set": {"email_notifications_enabled": bool(email_notifications_enabled)}}
    )
    
    return {"status": "success", "email_notifications_enabled": email_notifications_enabled}

@api_router.get("/me/email-preferences")
async def get_email_preferences(user: User = Depends(require_auth)):
    """Get current user's email notification preferences"""
    user_data = await db.users.find_one({"id": user.id}, {"_id": 0, "email_notifications_enabled": 1})
    return {"email_notifications_enabled": user_data.get("email_notifications_enabled", True)}


# Get conversations list
@api_router.get("/messages/conversations")
async def get_conversations(user: User = Depends(require_auth)):
    """Get list of conversations for current user"""
    # Get direct messages
    direct_messages = await db.direct_messages.find({
        "$or": [
            {"sender_id": user.id},
            {"receiver_id": user.id}
        ]
    }, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Get unique conversation partners
    conversation_users = set()
    for msg in direct_messages:
        if msg['sender_id'] != user.id:
            conversation_users.add(msg['sender_id'])
        if msg['receiver_id'] != user.id:
            conversation_users.add(msg['receiver_id'])
    
    # Get user details for conversations
    conversations = []
    for user_id in conversation_users:
        user_data = await db.users.find_one(
            {"id": user_id},
            {"_id": 0, "id": 1, "name": 1, "picture": 1, "role": 1}
        )
        if user_data:
            # Get last message
            last_msg_cursor = db.direct_messages.find(
                {
                    "$or": [
                        {"sender_id": user.id, "receiver_id": user_id},
                        {"sender_id": user_id, "receiver_id": user.id}
                    ]
                },
                {"_id": 0}
            ).sort("created_at", -1).limit(1)
            last_msg_list = await last_msg_cursor.to_list(1)
            last_msg = last_msg_list[0] if last_msg_list else None
            
            # Count unread messages
            unread_count = await db.direct_messages.count_documents({
                "sender_id": user_id,
                "receiver_id": user.id,
                "is_read": False
            })
            
            conversations.append({
                "type": "direct",
                "user": user_data,
                "last_message": last_msg,
                "unread_count": unread_count
            })
    
    # Get group conversations
    groups = await db.message_groups.find(
        {"member_ids": user.id},
        {"_id": 0}
    ).to_list(100)
    
    for group in groups:
        # Get last message in group
        last_msg_cursor = db.group_messages.find(
            {"group_id": group['id']},
            {"_id": 0}
        ).sort("created_at", -1).limit(1)
        last_msg_list = await last_msg_cursor.to_list(1)
        last_msg = last_msg_list[0] if last_msg_list else None
        
        # Get sender info if last message exists
        if last_msg:
            sender = await db.users.find_one(
                {"id": last_msg['sender_id']},
                {"_id": 0, "name": 1}
            )
            if sender:
                last_msg['sender_name'] = sender['name']
        
        conversations.append({
            "type": "group",
            "group": group,
            "last_message": last_msg,
            "unread_count": 0  # TODO: Implement group unread tracking
        })
    
    # Sort conversations by last message time
    conversations.sort(
        key=lambda x: x['last_message']['created_at'] if x['last_message'] else datetime.min.replace(tzinfo=timezone.utc),
        reverse=True
    )
    
    return conversations

# Get messages in a conversation
@api_router.get("/messages/direct/{other_user_id}")
async def get_direct_messages(other_user_id: str, user: User = Depends(require_auth), limit: int = 50):
    """Get direct messages with another user"""
    messages = await db.direct_messages.find({
        "$or": [
            {"sender_id": user.id, "receiver_id": other_user_id},
            {"sender_id": other_user_id, "receiver_id": user.id}
        ]
    }, {"_id": 0}).sort("created_at", 1).limit(limit).to_list(limit)
    
    # Mark messages as read
    await db.direct_messages.update_many(
        {"sender_id": other_user_id, "receiver_id": user.id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    # Convert datetime to ISO string
    for msg in messages:
        if 'created_at' in msg and isinstance(msg['created_at'], datetime):
            msg['created_at'] = msg['created_at'].isoformat()
    
    return messages

# Send direct message
@api_router.post("/messages/direct/{receiver_id}")
async def send_direct_message(receiver_id: str, request: Request, user: User = Depends(require_auth)):
    """Send a direct message to another user"""
    data = await request.json()
    content = data.get("content", "").strip()
    
    if not content:
        raise HTTPException(status_code=400, detail="Message content cannot be empty")
    
    # Check permissions
    can_send, error_msg = await can_send_message(user, receiver_id)
    if not can_send:
        raise HTTPException(status_code=403, detail=error_msg)
    
    # Check if receiver exists
    receiver = await db.users.find_one({"id": receiver_id})
    if not receiver:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create message
    message = DirectMessage(
        sender_id=user.id,
        receiver_id=receiver_id,
        content=content
    )
    
    msg_dict = message.model_dump()
    msg_dict['created_at'] = msg_dict['created_at'].isoformat()
    await db.direct_messages.insert_one(msg_dict)
    
    # Send real-time notification to receiver via WebSocket
    await ws_manager.send_personal_message(receiver_id, {
        "type": "new_message",
        "message": {
            "id": message.id,
            "sender_id": user.id,
            "sender_name": user.name,
            "sender_picture": user.picture,
            "receiver_id": receiver_id,
            "content": content,
            "created_at": msg_dict['created_at'],
            "is_read": False
        }
    })
    
    # Create in-app notification
    await create_notification(
        user_id=receiver_id,
        notif_type="new_message",
        title="New Message",
        message=f"{user.name} sent you a message",
        related_entity_id=message.id,
        related_entity_type="direct_message",
        actor_id=user.id,
        actor_name=user.name,
        send_email=False
    )
    
    return message

# Create message group (admin only)
@api_router.post("/messages/groups")
async def create_message_group(request: Request, user: User = Depends(require_auth)):
    """Create a new message group (admin only)"""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create message groups")
    
    data = await request.json()
    name = data.get("name", "").strip()
    description = data.get("description", "").strip()
    member_ids = data.get("member_ids", [])
    
    if not name:
        raise HTTPException(status_code=400, detail="Group name is required")
    
    if not member_ids or not isinstance(member_ids, list):
        raise HTTPException(status_code=400, detail="At least one member is required")
    
    # Verify all members exist
    for member_id in member_ids:
        member = await db.users.find_one({"id": member_id})
        if not member:
            raise HTTPException(status_code=404, detail=f"User {member_id} not found")
    
    # Add creator to members and managers
    if user.id not in member_ids:
        member_ids.append(user.id)
    
    group = MessageGroup(
        name=name,
        description=description,
        created_by=user.id,
        member_ids=member_ids,
        manager_ids=[user.id]  # Creator is automatically a manager
    )
    
    group_dict = group.model_dump()
    group_dict['created_at'] = group_dict['created_at'].isoformat()
    await db.message_groups.insert_one(group_dict)
    
    # Notify all members
    for member_id in member_ids:
        if member_id != user.id:
            await create_notification(
                user_id=member_id,
                notif_type="added_to_group",
                title="Added to Message Group",
                message=f"{user.name} added you to the group '{name}'",
                related_entity_id=group.id,
                related_entity_type="message_group",
                actor_id=user.id,
                actor_name=user.name,
                send_email=False
            )
    
    return group

# Get group messages
@api_router.get("/messages/groups/{group_id}")
async def get_group_messages(group_id: str, user: User = Depends(require_auth), limit: int = 50):
    """Get messages in a group"""
    # Check if user is a member
    group = await db.message_groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if user.id not in group['member_ids']:
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    
    messages = await db.group_messages.find(
        {"group_id": group_id},
        {"_id": 0}
    ).sort("created_at", 1).limit(limit).to_list(limit)
    
    # Enrich with sender info
    for msg in messages:
        sender = await db.users.find_one(
            {"id": msg['sender_id']},
            {"_id": 0, "name": 1, "picture": 1}
        )
        if sender:
            msg['sender_name'] = sender['name']
            msg['sender_picture'] = sender.get('picture')
        
        # Convert datetime
        if 'created_at' in msg and isinstance(msg['created_at'], datetime):
            msg['created_at'] = msg['created_at'].isoformat()
    
    return messages

# Send group message
@api_router.post("/messages/groups/{group_id}")
async def send_group_message(group_id: str, request: Request, user: User = Depends(require_auth)):
    """Send a message to a group"""
    data = await request.json()
    content = data.get("content", "").strip()
    
    if not content:
        raise HTTPException(status_code=400, detail="Message content cannot be empty")
    
    # Check if user is a member
    group = await db.message_groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if user.id not in group['member_ids']:
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    
    # Create message
    message = GroupMessage(
        group_id=group_id,
        sender_id=user.id,
        content=content
    )
    
    msg_dict = message.model_dump()
    msg_dict['created_at'] = msg_dict['created_at'].isoformat()
    await db.group_messages.insert_one(msg_dict)
    
    # Send real-time notification to all group members via WebSocket
    for member_id in group['member_ids']:
        if member_id != user.id:
            await ws_manager.send_personal_message(member_id, {
                "type": "new_group_message",
                "message": {
                    "id": message.id,
                    "group_id": group_id,
                    "group_name": group['name'],
                    "sender_id": user.id,
                    "sender_name": user.name,
                    "sender_picture": user.picture,
                    "content": content,
                    "created_at": msg_dict['created_at']
                }
            })
    
    return message

# Get user's groups
@api_router.get("/messages/my-groups")
async def get_my_groups(user: User = Depends(require_auth)):
    """Get groups the user is a member of"""
    groups = await db.message_groups.find(
        {"member_ids": user.id},
        {"_id": 0}
    ).to_list(100)
    
    # Convert datetime fields
    for group in groups:
        if 'created_at' in group and isinstance(group['created_at'], datetime):
            group['created_at'] = group['created_at'].isoformat()
    
    return groups

# Get group details (for admins/managers)
@api_router.get("/messages/groups/{group_id}/details")
async def get_group_details(group_id: str, user: User = Depends(require_auth)):
    """Get group details including member list (admin/manager only)"""
    group = await db.message_groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check if user is admin or manager
    if user.role != "admin" and user.id not in group['manager_ids']:
        raise HTTPException(status_code=403, detail="Only admins and managers can view group details")
    
    # Get member details
    members = []
    for member_id in group['member_ids']:
        member = await db.users.find_one(
            {"id": member_id},
            {"_id": 0, "id": 1, "name": 1, "picture": 1, "role": 1}
        )
        if member:
            members.append(member)
    
    group['members'] = members
    
    # Convert datetime
    if 'created_at' in group and isinstance(group['created_at'], datetime):
        group['created_at'] = group['created_at'].isoformat()
    
    return group

# Add member to group (admin/manager only)
@api_router.post("/messages/groups/{group_id}/members/{member_id}")
async def add_group_member(group_id: str, member_id: str, user: User = Depends(require_auth)):
    """Add a member to a group (admin/manager only)"""
    group = await db.message_groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check if user is admin or manager
    if user.role != "admin" and user.id not in group['manager_ids']:
        raise HTTPException(status_code=403, detail="Only admins and managers can add members")
    
    # Check if member exists
    member = await db.users.find_one({"id": member_id})
    if not member:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Add member if not already in group
    if member_id not in group['member_ids']:
        await db.message_groups.update_one(
            {"id": group_id},
            {"$push": {"member_ids": member_id}}
        )
        
        # Notify the new member
        await create_notification(
            user_id=member_id,
            notif_type="added_to_group",
            title="Added to Message Group",
            message=f"{user.name} added you to the group '{group['name']}'",
            related_entity_id=group_id,
            related_entity_type="message_group",
            actor_id=user.id,
            actor_name=user.name,
            send_email=False
        )
    
    return {"status": "success", "message": "Member added to group"}

# Remove member from group (admin/manager only)
@api_router.delete("/messages/groups/{group_id}/members/{member_id}")
async def remove_group_member(group_id: str, member_id: str, user: User = Depends(require_auth)):
    """Remove a member from a group (admin/manager only)"""
    group = await db.message_groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check if user is admin or manager
    if user.role != "admin" and user.id not in group['manager_ids']:
        raise HTTPException(status_code=403, detail="Only admins and managers can remove members")
    
    # Can't remove the creator
    if member_id == group['created_by']:
        raise HTTPException(status_code=400, detail="Cannot remove group creator")
    
    # Remove member
    await db.message_groups.update_one(
        {"id": group_id},
        {"$pull": {"member_ids": member_id, "manager_ids": member_id}}
    )
    
    return {"status": "success", "message": "Member removed from group"}



# Include router


# Notification endpoints
@api_router.get("/notifications")
async def get_notifications(user: User = Depends(require_auth), limit: int = 50):
    """Get user's notifications"""
    notifications = await db.notifications.find(
        {"user_id": user.id}, 
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return notifications

@api_router.get("/notifications/unread-count")
async def get_unread_count(user: User = Depends(require_auth)):
    """Get count of unread notifications"""
    count = await db.notifications.count_documents({
        "user_id": user.id,
        "is_read": False
    })
    return {"count": count}

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: User = Depends(require_auth)):
    """Mark a notification as read"""
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": user.id},
        {"$set": {"is_read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "success"}

@api_router.put("/notifications/mark-all-read")
async def mark_all_notifications_read(user: User = Depends(require_auth)):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": user.id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"status": "success"}


app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
