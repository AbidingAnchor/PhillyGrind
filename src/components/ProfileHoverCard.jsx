import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { fetchProfilePreview, isProfileUserId } from '../lib/profilePreview.js';
import { getUserAvatarColor } from '../lib/reactions.js';
import StaffTitleBadge from './StaffTitleBadge.jsx';

const SHOW_DELAY_MS = 260;
const HIDE_DELAY_MS = 200;
const CARD_WIDTH = 272;
const VIEWPORT_PAD = 8;
const GAP = 10;
const ESTIMATED_HEIGHT = 168;

function canUseHoverPreview() {
  return typeof window !== 'undefined'
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function trimBio(bio) {
  const text = String(bio || '').trim();
  if (text.length <= 160) return text;
  return `${text.slice(0, 157).trimEnd()}…`;
}

function computePosition(anchorRect, cardHeight) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = anchorRect.left;
  if (left + CARD_WIDTH > vw - VIEWPORT_PAD) {
    left = Math.max(VIEWPORT_PAD, vw - CARD_WIDTH - VIEWPORT_PAD);
  }
  if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;

  const spaceBelow = vh - anchorRect.bottom - GAP;
  const placeBelow = spaceBelow >= cardHeight || spaceBelow >= anchorRect.top - GAP;
  const top = placeBelow
    ? Math.min(anchorRect.bottom + GAP, vh - cardHeight - VIEWPORT_PAD)
    : Math.max(VIEWPORT_PAD, anchorRect.top - cardHeight - GAP);

  return { top, left };
}

export default function ProfileHoverTrigger({
  userId,
  fallbackName = '',
  fallbackAvatarUrl = '',
  children,
}) {
  const anchorRef = useRef(null);
  const cardRef = useRef(null);
  const showTimerRef = useRef(0);
  const hideTimerRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [preview, setPreview] = useState(null);

  const enabled = isProfileUserId(userId);

  function clearTimers() {
    window.clearTimeout(showTimerRef.current);
    window.clearTimeout(hideTimerRef.current);
  }

  function updatePosition(cardHeight = ESTIMATED_HEIGHT) {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setOpen(false);
      return;
    }
    setPosition(computePosition(rect, cardHeight));
  }

  function scheduleShow() {
    if (!enabled || !canUseHoverPreview()) return;
    window.clearTimeout(hideTimerRef.current);
    fetchProfilePreview(userId)
      .then((data) => {
        setPreview(data);
      })
      .catch(() => {
        setPreview(null);
      });
    showTimerRef.current = window.setTimeout(() => {
      updatePosition();
      setOpen(true);
    }, SHOW_DELAY_MS);
  }

  function scheduleHide() {
    window.clearTimeout(showTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, HIDE_DELAY_MS);
  }

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }

    function onReposition() {
      updatePosition(cardRef.current?.offsetHeight || ESTIMATED_HEIGHT);
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition(cardRef.current?.offsetHeight || ESTIMATED_HEIGHT);
  }, [open, preview]);

  if (!enabled) return children;

  const name = preview?.name || fallbackName || 'Neighbor';
  const avatarUrl = preview?.avatarUrl || fallbackAvatarUrl;
  const neighborhood = preview?.neighborhood || '';
  const bio = trimBio(preview?.bio);
  const initial = name.charAt(0) || '?';

  return (
    <>
      <span
        ref={anchorRef}
        className="profile-hover-anchor"
        onMouseEnter={scheduleShow}
        onMouseLeave={scheduleHide}
      >
        {children}
      </span>
      {open
        && createPortal(
          <div
            ref={cardRef}
            className="profile-hover-card"
            role="dialog"
            aria-label={`${name} profile preview`}
            style={{ top: position.top, left: position.left, width: CARD_WIDTH }}
            onMouseEnter={() => {
              window.clearTimeout(hideTimerRef.current);
            }}
            onMouseLeave={scheduleHide}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="profile-hover-card-header">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="profile-hover-card-avatar" draggable={false} />
              ) : (
                <div
                  className="profile-hover-card-avatar profile-hover-card-avatar-placeholder"
                  style={{ backgroundColor: getUserAvatarColor(userId, name) }}
                >
                  {initial}
                </div>
              )}
              <div className="profile-hover-card-identity">
                <strong className="profile-hover-card-name">
                  {name}
                  <StaffTitleBadge title={preview?.staffTitle} />
                </strong>
                {neighborhood ? (
                  <span className="profile-hover-card-location">
                    <MapPin size={13} aria-hidden="true" />
                    {neighborhood}
                  </span>
                ) : null}
              </div>
            </div>
            {bio ? <p className="profile-hover-card-bio">{bio}</p> : null}
            <Link to={`/profile/${userId}`} className="profile-hover-card-link">
              View profile
            </Link>
          </div>,
          document.body,
        )}
    </>
  );
}
