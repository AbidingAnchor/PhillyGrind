import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import {
  deleteAllNotifications,
  getNotifications,
  markNotificationsRead,
  subscribeToNotifications,
} from '../lib/notificationsApi.js';
import { useAuth } from '../lib/auth.jsx';

function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [status, setStatus] = useState('');
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const unreadCount = useMemo(() => (
    notifications.filter((notification) => !notification.read).length
  ), [notifications]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return undefined;
    }

    getNotifications(user.id)
      .then((loadedNotifications) => {
        console.log('Loaded notifications from Supabase', loadedNotifications);
        setNotifications(loadedNotifications);
      })
      .catch((error) => setStatus(error.message || 'Could not load notifications.'));

    return subscribeToNotifications({
      userId: user.id,
      onNotification: (notification) => {
        console.log('Realtime notification from Supabase', notification);
        setNotifications((current) => [notification, ...current].slice(0, 10));
        getNotifications(user.id)
          .then((loadedNotifications) => {
            console.log('Refreshed notifications from Supabase', loadedNotifications);
            setNotifications(loadedNotifications);
          })
          .catch((error) => setStatus(error.message || 'Could not refresh notifications.'));
      },
    });
  }, [user]);

  useEffect(() => {
    function handleClick(event) {
      if (!dropdownRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleToggle() {
    const nextOpen = !open;
    setOpen(nextOpen);

    if (nextOpen && user && unreadCount) {
      setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
      try {
        await markNotificationsRead(user.id);
      } catch (error) {
        setStatus(error.message || 'Could not mark notifications as read.');
      }
    }
  }

  function getNotificationPath(notification) {
    if (notification.listing_type && notification.listing_id) {
      const basePath = notification.listing_type === 'marketplace'
        ? '/marketplace'
        : `/${notification.listing_type === 'gig' ? 'gigs' : 'jobs'}/${notification.listing_id}`;
      const shouldOpenChat = notification.type === 'message' && notification.sender_id;

      if (notification.listing_type === 'marketplace' && shouldOpenChat) {
        return `${basePath}?listingId=${notification.listing_id}&openChat=true&senderId=${notification.sender_id}`;
      }

      return shouldOpenChat ? `${basePath}?openChat=true&senderId=${notification.sender_id}` : basePath;
    }

    return notification.listingPath || '/messages';
  }

  function handleNotificationClick(notification) {
    const path = getNotificationPath(notification);

    console.log('Notification click navigation', {
      notification,
      path,
      hasListingType: Boolean(notification.listing_type),
      hasSenderId: Boolean(notification.sender_id),
      listingId: notification.listing_id,
    });

    setOpen(false);
    navigate(path);
  }

  async function handleClearAll() {
    setStatus('');

    try {
      await deleteAllNotifications();
      setNotifications([]);
      setOpen(false);
    } catch (error) {
      setStatus(error.message || 'Could not clear notifications.');
    }
  }

  if (!user) return null;

  return (
    <div className="notification-menu" ref={dropdownRef}>
      <button className="notification-button" type="button" onClick={handleToggle} aria-label="Notifications">
        <Bell size={18} />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-dropdown">
          <h3>Notifications</h3>
          {status && <p className="notification-status">{status}</p>}
          {!notifications.length && <p className="notification-empty">No notifications yet.</p>}
          <div className="notification-list">
            {notifications.map((notification) => {
              console.log('Rendering notification', notification);
              const message = notification.message || 'Notification';

              return (
                <button
                  key={notification.id}
                  type="button"
                  className="notification-item"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <span>{message}</span>
                  <time>{new Date(notification.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</time>
                </button>
              );
            })}
          </div>
          {notifications.length > 0 && (
            <div className="notification-footer">
              <button className="notification-clear" type="button" onClick={handleClearAll}>
                Clear All
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
