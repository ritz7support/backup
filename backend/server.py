from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Header
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
    total_points: int = 0  # Leaderboard: Total points earned
    current_level: int = 1  # Leaderboard: Current level number
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
    plan: str  # monthly_inr, yearly_inr, monthly_usd, yearly_usd
    amount: float
    currency: str  # INR, USD
    payment_gateway: str  # razorpay, stripe
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
    price: float = 0  # Monthly price
    currency: str = "USD"
    features: List[str] = []  # List of features
    is_active: bool = True
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
    points: int  # Points awarded (can be negative for penalties)
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

# Notification Models
class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str  # comment, reaction, tag, event_invite, dm
    title: str
    message: str
    link: Optional[str] = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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

async def award_points(user_id: str, points: int, action_type: str, related_entity_type: str = None, 
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
async def register(user_data: UserCreate, response: Response, invite_token: Optional[str] = None):
    """Register new user with email/password"""
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
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
    
    # Check founding member status (first 100 users)
    user_count = await db.users.count_documents({})
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
        badges=["🎉 Founding 100"] if is_founding else []
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

PRICING = {
    "monthly_inr": {"amount": 99.0, "currency": "INR", "gateway": "razorpay"},
    "yearly_inr": {"amount": 999.0, "currency": "INR", "gateway": "razorpay"},
    "monthly_usd": {"amount": 5.0, "currency": "USD", "gateway": "stripe"},
    "yearly_usd": {"amount": 49.0, "currency": "USD", "gateway": "stripe"}
}

@api_router.post("/payments/create-order")
async def create_payment_order(request: Request, plan: str, user: User = Depends(require_auth)):
    """Create payment order (Razorpay or Stripe)"""
    if plan not in PRICING:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    plan_info = PRICING[plan]
    
    if plan_info['gateway'] == 'razorpay':
        # Razorpay order
        try:
            amount_paise = int(plan_info['amount'] * 100)
            order_data = {
                "amount": amount_paise,
                "currency": plan_info['currency'],
                "payment_capture": 1
            }
            razor_order = razorpay_client.order.create(data=order_data)
            
            # Create transaction record
            transaction = PaymentTransaction(
                user_id=user.id,
                amount=plan_info['amount'],
                currency=plan_info['currency'],
                payment_gateway='razorpay',
                gateway_order_id=razor_order['id'],
                status='pending',
                metadata={"plan": plan}
            )
            trans_dict = transaction.model_dump()
            trans_dict['created_at'] = trans_dict['created_at'].isoformat()
            await db.payment_transactions.insert_one(trans_dict)
            
            return {
                "order_id": razor_order['id'],
                "amount": plan_info['amount'],
                "currency": plan_info['currency'],
                "key_id": os.environ.get('RAZORPAY_KEY_ID', 'test_key')
            }
        except Exception as e:
            logger.error(f"Razorpay error: {e}")
            raise HTTPException(status_code=500, detail="Payment gateway error")
    
    elif plan_info['gateway'] == 'stripe':
        # Stripe checkout
        try:
            body = await request.json()
            origin_url = body.get('origin_url', str(request.base_url))
            
            success_url = f"{origin_url}payment-success?session_id={{CHECKOUT_SESSION_ID}}"
            cancel_url = f"{origin_url}pricing"
            
            stripe_api_key = os.environ.get('STRIPE_API_KEY', 'sk_test_emergent')
            webhook_url = f"{origin_url}api/webhook/stripe"
            stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
            
            checkout_request = CheckoutSessionRequest(
                amount=plan_info['amount'],
                currency=plan_info['currency'].lower(),
                success_url=success_url,
                cancel_url=cancel_url,
                metadata={"plan": plan, "user_id": user.id}
            )
            
            session = await stripe_checkout.create_checkout_session(checkout_request)
            
            # Create transaction record
            transaction = PaymentTransaction(
                user_id=user.id,
                amount=plan_info['amount'],
                currency=plan_info['currency'],
                payment_gateway='stripe',
                session_id=session.session_id,
                status='pending',
                metadata={"plan": plan}
            )
            trans_dict = transaction.model_dump()
            trans_dict['created_at'] = trans_dict['created_at'].isoformat()
            await db.payment_transactions.insert_one(trans_dict)
            
            return {"url": session.url, "session_id": session.session_id}
        except Exception as e:
            logger.error(f"Stripe error: {e}")
            raise HTTPException(status_code=500, detail="Payment gateway error")

@api_router.get("/payments/status/{session_id}")
async def check_payment_status(session_id: str, user: User = Depends(require_auth)):
    """Check Stripe payment status"""
    try:
        stripe_api_key = os.environ.get('STRIPE_API_KEY', 'sk_test_emergent')
        webhook_url = f"{os.environ.get('BACKEND_URL', '')}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
        
        status = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction
        transaction = await db.payment_transactions.find_one({"session_id": session_id, "user_id": user.id})
        if transaction and transaction['status'] == 'pending' and status.payment_status == 'paid':
            await db.payment_transactions.update_one(
                {"id": transaction['id']},
                {"$set": {"status": "completed"}}
            )
            
            # Create subscription
            plan = transaction['metadata'].get('plan')
            plan_info = PRICING.get(plan)
            if plan_info:
                duration_days = 365 if 'yearly' in plan else 30
                subscription = Subscription(
                    user_id=user.id,
                    plan=plan,
                    amount=plan_info['amount'],
                    currency=plan_info['currency'],
                    payment_gateway=plan_info['gateway'],
                    status='active',
                    starts_at=datetime.now(timezone.utc),
                    ends_at=datetime.now(timezone.utc) + timedelta(days=duration_days)
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
    """Get posts in a space"""
    posts = await db.posts.find({"space_id": space_id}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
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
    
    # Award points only when adding a like (not removing)
    if is_adding:
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
    
    return {"reactions": reactions}

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
    
    # Award points only when adding a like (not removing)
    if is_adding:
        # Award 1 point to the person reacting
        await award_points(
            user_id=user.id,
            points=1,
            action_type="like_comment",
            related_entity_type="comment",
            related_entity_id=comment_id,
            related_user_id=comment['author_id'],
            description="Reacted to a comment"
        )
        
        # Award 1 point to the comment author (if not self-reaction)
        if user.id != comment['author_id']:
            await award_points(
                user_id=comment['author_id'],
                points=1,
                action_type="receive_like_comment",
                related_entity_type="comment",
                related_entity_id=comment_id,
                related_user_id=user.id,
                description="Received a reaction on comment"
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
        
        # Check if profile was incomplete before
        was_incomplete = not (current_user.get('bio') and current_user.get('location'))
        
        await db.users.update_one({"id": user.id}, {"$set": update_fields})
        
        # Check if profile is now complete (after update)
        updated_user = await db.users.find_one({"id": user.id}, {"_id": 0})
        is_now_complete = updated_user.get('bio') and updated_user.get('location')
        
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
                    description="Completed profile (bio + location)"
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

@api_router.get("/notifications")
async def get_notifications(user: User = Depends(require_auth)):
    """Get user notifications"""
    notifications = await db.notifications.find({"user_id": user.id}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: User = Depends(require_auth)):
    """Mark notification as read"""
    await db.notifications.update_one(
        {"id": notification_id, "user_id": user.id},
        {"$set": {"is_read": True}}
    )
    return {"message": "Marked as read"}

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

# Include router
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
