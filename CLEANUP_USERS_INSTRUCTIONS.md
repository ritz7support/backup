# ONE-TIME USER CLEANUP ENDPOINT

## How to Use

This endpoint will delete ALL users and user-related data while keeping:
- ✅ Spaces and Space Groups
- ✅ Subscription Tiers
- ✅ Platform Settings
- ✅ Levels

---

## Method 1: Using curl (Terminal/Command Line)

```bash
curl -X POST https://app.abcd.ritz7.com/api/admin/cleanup-all-users \
  -H "Content-Type: application/json" \
  -d '{"confirmation": "DELETE_ALL_USERS_PERMANENTLY"}'
```

---

## Method 2: Using Postman or any API client

**URL:** `https://app.abcd.ritz7.com/api/admin/cleanup-all-users`

**Method:** `POST`

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "confirmation": "DELETE_ALL_USERS_PERMANENTLY"
}
```

---

## Method 3: Using Browser Console

1. Open https://app.abcd.ritz7.com in your browser
2. Open Developer Tools (F12)
3. Go to Console tab
4. Paste and run this code:

```javascript
fetch('https://app.abcd.ritz7.com/api/admin/cleanup-all-users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    confirmation: 'DELETE_ALL_USERS_PERMANENTLY'
  })
})
.then(response => response.json())
.then(data => {
  console.log('✅ Cleanup Result:', data);
  alert('Cleanup successful! Check console for details.');
})
.catch(error => {
  console.error('❌ Error:', error);
  alert('Cleanup failed. Check console for details.');
});
```

---

## Expected Response

```json
{
  "message": "✅ All users and user-related data deleted successfully",
  "deleted_counts": {
    "users": 32,
    "sessions": 236,
    "posts": 17,
    "comments": 13,
    "memberships": 241,
    "messages": 3,
    "notifications": 16,
    "point_transactions": 41,
    "join_requests": 8,
    "invite_tokens": 11,
    "groups": 0,
    "group_messages": 4,
    "user_preferences": 2
  },
  "preserved": [
    "Spaces",
    "Space Groups",
    "Subscription Tiers",
    "Platform Settings",
    "Levels"
  ],
  "note": "The next user to register will automatically become admin"
}
```

---

## IMPORTANT NOTES

⚠️ **This endpoint does NOT require authentication** - so you can call it even without logging in

⚠️ **It requires the exact confirmation phrase** for safety: `DELETE_ALL_USERS_PERMANENTLY`

⚠️ **This is a ONE-TIME operation** - use it to clean test users before your first real registration

✅ **After cleanup:**
1. Visit https://app.abcd.ritz7.com/register
2. Register with your email
3. You will automatically become the admin (first user)
4. The app is ready to use!

---

## What Gets Deleted

- All users
- All user sessions
- All posts and comments
- All space memberships
- All messages (direct and group)
- All notifications
- All point transactions
- All join requests
- All invite tokens
- All user preferences

## What Gets Preserved

- All Spaces and Space Groups
- Subscription Tiers
- Platform Settings (logo, colors, etc.)
- Levels and point requirements
- Space member counts are reset to 0
