# Notification System Implementation TODO

## Current Status: ⚠️ NOT COMPLETE - Only Groundwork Done

### ✅ Completed (Partial Implementation)
1. **Notification Model Added** (`/app/backend/server.py` line ~151)
   - Fields: id, user_id, type, title, message, related_entity_id, related_entity_type, actor_id, actor_name, is_read, created_at
   
2. **SendGrid Package Installed**
   - Added to `/app/backend/requirements.txt`
   - Imported in server.py
   
3. **Helper Functions Created** (line ~430)
   - `send_email_notification()` - Sends emails via SendGrid
   - `create_notification()` - Creates notification in DB and optionally sends email

---

## 🚧 TODO: Backend Implementation

### 1. Add SendGrid Configuration to .env
```env
# Add to /app/backend/.env
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDER_EMAIL=noreply@yourdomain.com
```

### 2. Create Notification API Endpoints

**Add these endpoints to `/app/backend/server.py`:**

```python
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
```

### 3. Add Notification Triggers to Existing Endpoints

**Location: Find these functions in `/app/backend/server.py` and add notification creation**

#### A. Post Reactions (line ~1700)
```python
@api_router.post("/posts/{post_id}/react")
async def react_to_post(...):
    # After creating reaction, ADD:
    
    # Get post and notify author
    post = await db.posts.find_one({"id": post_id})
    if post and post['user_id'] != user.id:  # Don't notify self
        await create_notification(
            user_id=post['user_id'],
            notif_type="post_like",
            title="Someone liked your post",
            message=f"{user.name} liked your post",
            related_entity_id=post_id,
            related_entity_type="post",
            actor_id=user.id,
            actor_name=user.name,
            send_email=False  # In-app only
        )
```

#### B. Comments (line ~1800)
```python
@api_router.post("/posts/{post_id}/comments")
async def add_comment(...):
    # After creating comment, ADD:
    
    # Notify post author
    post = await db.posts.find_one({"id": post_id})
    if post and post['user_id'] != user.id:
        await create_notification(
            user_id=post['user_id'],
            notif_type="comment",
            title="New comment on your post",
            message=f"{user.name} commented on your post",
            related_entity_id=post_id,
            related_entity_type="post",
            actor_id=user.id,
            actor_name=user.name,
            send_email=False
        )
    
    # If replying to another comment, notify that commenter too
    if parent_comment_id:
        parent_comment = await db.comments.find_one({"id": parent_comment_id})
        if parent_comment and parent_comment['user_id'] != user.id:
            await create_notification(
                user_id=parent_comment['user_id'],
                notif_type="comment_reply",
                title="Someone replied to your comment",
                message=f"{user.name} replied to your comment",
                related_entity_id=post_id,
                related_entity_type="post",
                actor_id=user.id,
                actor_name=user.name,
                send_email=False
            )
```

#### C. Comment Reactions (line ~1900)
```python
@api_router.post("/comments/{comment_id}/react")
async def react_to_comment(...):
    # After creating reaction, ADD:
    
    comment = await db.comments.find_one({"id": comment_id})
    if comment and comment['user_id'] != user.id:
        await create_notification(
            user_id=comment['user_id'],
            notif_type="comment_like",
            title="Someone liked your comment",
            message=f"{user.name} liked your comment",
            related_entity_id=comment['post_id'],
            related_entity_type="post",
            actor_id=user.id,
            actor_name=user.name,
            send_email=False
        )
```

#### D. Join Request Approved (line ~2290)
```python
@api_router.put("/join-requests/{request_id}/approve")
async def approve_join_request(...):
    # After approval, ADD:
    
    request = await db.join_requests.find_one({"id": request_id})
    space = await db.spaces.find_one({"id": request['space_id']})
    
    await create_notification(
        user_id=request['user_id'],
        notif_type="join_approved",
        title="Join request approved!",
        message=f"Your request to join {space['name']} has been approved",
        related_entity_id=space['id'],
        related_entity_type="space",
        actor_id=user.id,
        actor_name=user.name,
        send_email=True  # IMPORTANT - send email
    )
```

#### E. Join Request Rejected (line ~2345)
```python
@api_router.put("/join-requests/{request_id}/reject")
async def reject_join_request(...):
    # After rejection, ADD:
    
    request = await db.join_requests.find_one({"id": request_id})
    space = await db.spaces.find_one({"id": request['space_id']})
    
    await create_notification(
        user_id=request['user_id'],
        notif_type="join_rejected",
        title="Join request declined",
        message=f"Your request to join {space['name']} was declined",
        related_entity_id=space['id'],
        related_entity_type="space",
        actor_id=user.id,
        actor_name=user.name,
        send_email=True  # IMPORTANT - send email
    )
```

#### F. New Join Request Created (line ~2220)
```python
@api_router.post("/spaces/{space_id}/join")
async def create_join_request(...):
    # After creating join request, ADD:
    
    space = await db.spaces.find_one({"id": space_id})
    
    # Notify all admins and managers of this space
    # 1. Notify global admins
    admins = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(100)
    for admin in admins:
        await create_notification(
            user_id=admin['id'],
            notif_type="join_request",
            title="New join request",
            message=f"{user.name} wants to join {space['name']}",
            related_entity_id=space_id,
            related_entity_type="space",
            actor_id=user.id,
            actor_name=user.name,
            send_email=True  # IMPORTANT - send email to admins
        )
    
    # 2. Notify space managers
    managers = await db.space_memberships.find({
        "space_id": space_id,
        "role": "manager"
    }, {"_id": 0, "user_id": 1}).to_list(100)
    for manager in managers:
        await create_notification(
            user_id=manager['user_id'],
            notif_type="join_request",
            title="New join request",
            message=f"{user.name} wants to join {space['name']}",
            related_entity_id=space_id,
            related_entity_type="space",
            actor_id=user.id,
            actor_name=user.name,
            send_email=True
        )
```

#### G. New Announcement Post (line ~1600)
```python
@api_router.post("/posts")
async def create_post(...):
    # After creating post, ADD:
    
    # Check if space is announcement-only (admin-only posting)
    space = await db.spaces.find_one({"id": space_id})
    if space and not space.get('allow_member_posts', True):
        # This is an announcement space - notify all members
        memberships = await db.space_memberships.find(
            {"space_id": space_id},
            {"_id": 0, "user_id": 1}
        ).to_list(1000)
        
        for membership in memberships:
            if membership['user_id'] != user.id:  # Don't notify self
                await create_notification(
                    user_id=membership['user_id'],
                    notif_type="announcement",
                    title=f"New announcement in {space['name']}",
                    message=f"Check out the latest announcement",
                    related_entity_id=post_id,
                    related_entity_type="post",
                    actor_id=user.id,
                    actor_name=user.name,
                    send_email=True  # IMPORTANT - send email for announcements
                )
```

#### H. User Promoted to Manager/Admin (line ~2400)
```python
# When promoting a user, ADD notification:
await create_notification(
    user_id=target_user_id,
    notif_type="promoted",
    title="You've been promoted!",
    message=f"You are now a {new_role} of {space_name}",
    related_entity_id=space_id,
    related_entity_type="space",
    actor_id=user.id,
    actor_name=user.name,
    send_email=True  # IMPORTANT - send email
)
```

---

## 🚧 TODO: Frontend Implementation

### 1. Create Notification API Client

**Add to `/app/frontend/src/lib/api.js`:**

```javascript
// Notifications API
export const notificationsAPI = {
  getNotifications: (limit = 50) => api.get('/notifications', { params: { limit } }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (notificationId) => api.put(`/notifications/${notificationId}/read`),
  markAllAsRead: () => api.put('/notifications/mark-all-read'),
};
```

### 2. Create NotificationBell Component

**Create `/app/frontend/src/components/NotificationBell.js`:**

```javascript
import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { notificationsAPI } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Dialog, DialogContent } from './ui/dialog';

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const navigate = useNavigate();

  const loadUnreadCount = async () => {
    try {
      const { data } = await notificationsAPI.getUnreadCount();
      setUnreadCount(data.count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      const { data } = await notificationsAPI.getNotifications(20);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.is_read) {
      await notificationsAPI.markAsRead(notification.id);
      loadUnreadCount();
    }

    // Navigate to related content
    if (notification.related_entity_type === 'post') {
      navigate(`/posts/${notification.related_entity_id}`);
    } else if (notification.related_entity_type === 'space') {
      navigate(`/spaces/${notification.related_entity_id}`);
    }

    setShowPanel(false);
  };

  const handleMarkAllRead = async () => {
    await notificationsAPI.markAllAsRead();
    loadUnreadCount();
    loadNotifications();
  };

  useEffect(() => {
    loadUnreadCount();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (showPanel) {
      loadNotifications();
    }
  }, [showPanel]);

  return (
    <>
      <button
        onClick={() => setShowPanel(true)}
        className="relative p-2 hover:bg-gray-100 rounded-full"
      >
        <Bell className="h-6 w-6" style={{ color: '#0462CB' }} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <Dialog open={showPanel} onOpenChange={setShowPanel}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-xl">Notifications</h3>
              {unreadCount > 0 && (
                <Button size="sm" variant="ghost" onClick={handleMarkAllRead}>
                  Mark all read
                </Button>
              )}
            </div>

            {notifications.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No notifications</p>
            ) : (
              <div className="space-y-2">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3 rounded-lg cursor-pointer hover:bg-gray-50 ${
                      !notif.is_read ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-white border border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{notif.title}</p>
                        <p className="text-sm text-gray-600">{notif.message}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(notif.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

### 3. Add NotificationBell to Dashboard

**Update `/app/frontend/src/pages/Dashboard.js`:**

```javascript
import NotificationBell from '../components/NotificationBell';

// In the header, add:
<div className="flex items-center gap-3">
  <NotificationBell />
  {/* Existing leaderboard icon */}
  {/* Existing user dropdown */}
</div>
```

---

## 📧 Email Template Guidelines

When sending emails, use this structure in `create_notification()`:

```html
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0462CB 0%, #034B9B 100%); padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0;">Community Platform</h1>
      </div>
      <div style="background: white; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="color: #0462CB;">{TITLE}</h2>
        <p>{MESSAGE}</p>
        <a href="{LINK_TO_CONTENT}" style="display: inline-block; background: #0462CB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px;">
          View in App
        </a>
      </div>
      <div style="margin-top: 20px; padding: 20px; text-align: center;">
        <p style="font-size: 12px; color: #888;">
          This is an automated notification. Please do not reply to this email.
        </p>
      </div>
    </div>
  </body>
</html>
```

---

## 🧪 Testing Checklist

### Backend Testing
- [ ] Create notification manually via create_notification()
- [ ] Test GET /api/notifications endpoint
- [ ] Test GET /api/notifications/unread-count endpoint
- [ ] Test PUT /api/notifications/{id}/read endpoint
- [ ] Test PUT /api/notifications/mark-all-read endpoint
- [ ] Test notification creation on post like
- [ ] Test notification creation on comment
- [ ] Test notification creation on join request
- [ ] Test email sending for important notifications

### Frontend Testing
- [ ] Bell icon shows in header
- [ ] Unread count badge displays correctly
- [ ] Click bell opens notification panel
- [ ] Notifications display in panel
- [ ] Click notification navigates to content
- [ ] Mark as read works
- [ ] Mark all as read works
- [ ] Real-time polling updates unread count

---

## 📝 Notes

- **Email Rate Limits**: SendGrid free tier has limits. Monitor usage.
- **Performance**: Consider background tasks for email sending
- **Notification Cleanup**: Add cron job to delete old notifications (90+ days)
- **Push Notifications**: Future enhancement for mobile/PWA
- **Notification Preferences**: Future enhancement to let users choose what they want to be notified about

---

## 🔧 Environment Variables Needed

```env
# Backend .env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
SENDER_EMAIL=noreply@yourdomain.com
```

---

## Estimated Implementation Time

- Backend endpoints: 2-3 hours
- Adding triggers to existing endpoints: 3-4 hours
- Frontend components: 2-3 hours
- Testing and debugging: 2-3 hours
- **Total: 9-13 hours of development**

---

## Priority Order for Implementation

1. **High Priority** (Do First):
   - Notification API endpoints
   - Join request approved/rejected notifications (with email)
   - Frontend bell icon and panel
   
2. **Medium Priority**:
   - Post/comment reaction notifications
   - Comment reply notifications
   - Announcement notifications
   
3. **Low Priority** (Can be added later):
   - Promotion notifications
   - Additional email templates
   - Notification preferences

---

**Status**: Ready for implementation when you return to this task
**Document Created**: January 2025
**Last Updated**: January 2025
