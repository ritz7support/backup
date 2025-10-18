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
    badges: List[str] = []
    membership_tier: str = "free"  # free, paid
    archived: bool = False
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
    member_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SpaceMembership(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    space_id: str
    user_id: str
    status: str = "member"  # pending, member
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
        
        # Determine visibility
        if space.get('visibility') == 'secret':
            # Secret spaces only visible if member or admin
            if not (membership or is_admin):
                continue
        
        space['is_member'] = bool(membership)
        space['membership_status'] = membership.get('status') if membership else None
        
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
    
    return post

@api_router.post("/posts/{post_id}/react")
async def react_to_post(post_id: str, emoji: str, user: User = Depends(require_auth)):
    """Add reaction to post"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    reactions = post.get('reactions', {})
    if emoji not in reactions:
        reactions[emoji] = []
    
    if user.id in reactions[emoji]:
        reactions[emoji].remove(user.id)
    else:
        reactions[emoji].append(user.id)
    
    await db.posts.update_one({"id": post_id}, {"$set": {"reactions": reactions}})
    return {"reactions": reactions}

@api_router.post("/posts/{post_id}/comments")
async def add_comment(post_id: str, request: Request, user: User = Depends(require_auth)):
    """Add comment to post"""
    data = await request.json()
    
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
        await db.users.update_one({"id": user.id}, {"$set": update_fields})
    
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
