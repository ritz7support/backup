import { useState, useEffect, useRef } from 'react';
import { Bell, X } from 'lucide-react';
import { notificationsAPI } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

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
      setLoading(true);
      const { data } = await notificationsAPI.getNotifications(20);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.is_read) {
      await notificationsAPI.markAsRead(notification.id);
      loadUnreadCount();
      loadNotifications();
    }

    // Navigate to related content
    if (notification.related_entity_type === 'post') {
      // For post notifications, we need to fetch the post to get space_id
      // For now, just close the panel - can enhance later
      setShowPanel(false);
    } else if (notification.related_entity_type === 'space') {
      navigate(`/space/${notification.related_entity_id}`);
      setShowPanel(false);
    } else {
      setShowPanel(false);
    }
  };

  const handleMarkAllRead = async () => {
    await notificationsAPI.markAllAsRead();
    loadUnreadCount();
    loadNotifications();
  };

  const handleDeleteNotification = async (notificationId, event) => {
    // Stop propagation to prevent navigation
    event.stopPropagation();
    
    try {
      await notificationsAPI.deleteNotification(notificationId);
      // Update local state
      setNotifications(notifications.filter(n => n.id !== notificationId));
      // Reload unread count
      loadUnreadCount();
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
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

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        panelRef.current && 
        !panelRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setShowPanel(false);
      }
    };

    if (showPanel) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPanel]);

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'post_like':
      case 'comment_like':
        return '❤️';
      case 'comment':
        return '💬';
      case 'comment_reply':
        return '🔔';
      case 'join_approved':
        return '✅';
      case 'join_rejected':
        return '❌';
      case 'join_request':
        return '📩';
      case 'announcement':
        return '📢';
      default:
        return '🔔';
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setShowPanel(!showPanel)}
        className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
      >
        <Bell className="h-6 w-6" style={{ color: '#0462CB' }} />
        {unreadCount > 0 && (
          <span 
            className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse"
            style={{ fontSize: '10px' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showPanel && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50"
          style={{ maxHeight: '80vh', overflowY: 'auto' }}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 rounded-t-lg flex items-center justify-between">
            <h3 className="font-bold text-lg" style={{ color: '#011328' }}>Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button size="sm" variant="ghost" onClick={handleMarkAllRead} className="text-xs">
                  Mark all read
                </Button>
              )}
              <button 
                onClick={() => setShowPanel(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-2">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No notifications yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-lg transition-colors relative group ${
                      !notif.is_read 
                        ? 'bg-blue-50 border-l-4 border-blue-500' 
                        : 'bg-white border border-gray-200'
                    }`}
                  >
                    <div 
                      className="cursor-pointer"
                      onClick={() => handleNotificationClick(notif)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl flex-shrink-0">
                          {getNotificationIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0 pr-8">
                          <p className={`font-semibold text-sm ${!notif.is_read ? 'text-blue-900' : 'text-gray-900'}`}>
                            {notif.title}
                          </p>
                          <p className="text-sm text-gray-600">
                            {notif.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(notif.created_at).toLocaleString()}
                          </p>
                        </div>
                        {!notif.is_read && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2"></div>
                        )}
                      </div>
                    </div>
                    {/* Delete button - appears on hover */}
                    <button
                      onClick={(e) => handleDeleteNotification(notif.id, e)}
                      className="absolute top-2 right-2 p-1 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete notification"
                    >
                      <X className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
