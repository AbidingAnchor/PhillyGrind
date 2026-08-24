import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Briefcase, Image, Smile, X } from 'lucide-react';
import ProfileListbox from '../ProfileListbox.jsx';
import {
  COMMUNITY_NEIGHBORHOODS,
  createCommunityPost,
} from '../../lib/communityApi.js';
import { getUserAvatarColor } from '../../lib/reactions.js';

const COMPOSER_FEELINGS = [
  { emoji: '😊', label: 'Happy' },
  { emoji: '🙌', label: 'Grateful' },
  { emoji: '💼', label: 'Hustling' },
  { emoji: '☕', label: 'Chill' },
  { emoji: '🔥', label: 'Motivated' },
  { emoji: '🤝', label: 'Looking to connect' },
];

function defaultComposerNeighborhood(profileNeighborhood) {
  if (profileNeighborhood && COMMUNITY_NEIGHBORHOODS.includes(profileNeighborhood)) {
    return profileNeighborhood;
  }
  return COMMUNITY_NEIGHBORHOODS[0];
}

export default function CommunityComposer({
  isLoggedIn,
  user,
  profile,
  homeNeighborhood,
  groupId = null,
  defaultNeighborhood,
  eyebrow = 'Community',
  title = 'Create post',
  prompt = "What's on your mind, neighbor?",
  showJobShortcut = true,
  loginFrom = '/community',
  seedContent = '',
  onSeedConsumed,
  onOptimisticAdd,
  onCommit,
  onFail,
}) {
  const navigate = useNavigate();
  const photoInputRef = useRef(null);
  const [showComposer, setShowComposer] = useState(false);
  const [composerContent, setComposerContent] = useState('');
  const [composerNeighborhood, setComposerNeighborhood] = useState(
    defaultComposerNeighborhood(defaultNeighborhood || homeNeighborhood),
  );
  const [composerPhoto, setComposerPhoto] = useState(null);
  const [composerPhotoPreview, setComposerPhotoPreview] = useState(null);
  const [composerFeeling, setComposerFeeling] = useState(null);
  const [showFeelingPicker, setShowFeelingPicker] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);

  useEffect(() => {
    if (!seedContent) return;
    setComposerContent(seedContent);
    setComposerNeighborhood(defaultComposerNeighborhood(defaultNeighborhood || homeNeighborhood));
    setShowComposer(true);
    onSeedConsumed?.();
  }, [seedContent, defaultNeighborhood, homeNeighborhood, onSeedConsumed]);

  useEffect(() => {
    if (!showComposer) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeComposer();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showComposer]);

  function resetComposerFields() {
    setComposerContent('');
    setComposerNeighborhood(defaultComposerNeighborhood(defaultNeighborhood || homeNeighborhood));
    setComposerFeeling(null);
    setShowFeelingPicker(false);
    setComposerPhoto(null);
    setComposerPhotoPreview(null);
  }

  function closeComposer() {
    setShowComposer(false);
    setShowFeelingPicker(false);
  }

  function handleComposerClick() {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: loginFrom } });
      return;
    }
    setComposerNeighborhood(defaultComposerNeighborhood(defaultNeighborhood || homeNeighborhood));
    setShowComposer(true);
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (file) {
      setComposerPhoto(file);
      setComposerPhotoPreview(URL.createObjectURL(file));
    }
    event.target.value = '';
  }

  function handleRemovePhoto() {
    setComposerPhoto(null);
    setComposerPhotoPreview(null);
  }

  function handleCreateJobShortcut() {
    closeComposer();
    if (!isLoggedIn) {
      navigate('/login', { state: { from: '/jobs?tab=post' } });
      return;
    }
    navigate('/jobs?tab=post');
  }

  async function handleSubmitPost(event) {
    event?.preventDefault();
    if (!composerContent.trim() && !composerPhoto) {
      alert('Please write something or add a photo to post.');
      return;
    }

    setSubmittingPost(true);

    const tempPostId = `temp-${Date.now()}`;
    const pendingContent = composerFeeling
      ? `${composerFeeling.emoji} Feeling ${composerFeeling.label}\n\n${composerContent}`.trim()
      : composerContent;
    const tempPost = {
      id: tempPostId,
      content: pendingContent,
      neighborhood: composerNeighborhood,
      photo: composerPhoto,
      created_at: new Date().toISOString(),
      user_id: user?.id,
      profiles: profile,
      like_count: 0,
      comment_count: 0,
      reaction_breakdown: [],
      group_id: groupId || null,
      is_temp: true,
    };

    onOptimisticAdd?.(tempPost);
    const contentToPost = pendingContent;
    const neighborhoodToPost = composerNeighborhood;
    const photoToPost = composerPhoto;
    resetComposerFields();
    closeComposer();

    try {
      const newPost = await createCommunityPost(
        {
          content: contentToPost,
          neighborhood: neighborhoodToPost,
          groupId,
        },
        photoToPost,
      );
      onCommit?.(tempPostId, newPost);
    } catch (error) {
      onFail?.(tempPostId);
      alert(error.message);
      setComposerContent(
        contentToPost.includes('\n\n') ? contentToPost.split('\n\n').slice(1).join('\n\n') : contentToPost,
      );
      setComposerNeighborhood(neighborhoodToPost);
      if (photoToPost) {
        setComposerPhoto(photoToPost);
        setComposerPhotoPreview(URL.createObjectURL(photoToPost));
      }
      setShowComposer(true);
    } finally {
      setSubmittingPost(false);
    }
  }

  return (
    <>
      <div className="feed-composer-wrapper">
        <button
          type="button"
          className="feed-composer-entry"
          onClick={handleComposerClick}
          aria-label="Create a post"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="feed-composer-avatar" />
          ) : (
            <div
              className="feed-composer-avatar-placeholder"
              style={{ backgroundColor: getUserAvatarColor(user?.id, profile?.name || user?.name) }}
            >
              {(profile?.name || user?.name)?.charAt(0) || 'Y'}
            </div>
          )}
          <div className="feed-composer-entry-copy">
            <span className="feed-composer-entry-name">{profile?.name || user?.name || 'Neighbor'}</span>
            <span className="feed-composer-entry-prompt">{prompt}</span>
          </div>
          <div className="feed-composer-entry-actions" aria-hidden="true">
            <span className="feed-composer-entry-action" title="Photo/video">
              <Image size={16} />
            </span>
            <span className="feed-composer-entry-action" title="Feeling/activity">
              <Smile size={16} />
            </span>
          </div>
        </button>
      </div>

      {showComposer && createPortal(
        <div
          className="community-compose-modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeComposer();
          }}
        >
          <div
            className="community-compose-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="community-compose-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="community-compose-modal-header">
              <div className="community-compose-modal-heading">
                <span className="eyebrow">{eyebrow}</span>
                <h2 id="community-compose-title">{title}</h2>
              </div>
              <button
                type="button"
                className="community-compose-modal-close"
                onClick={closeComposer}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form className="community-compose-form" onSubmit={handleSubmitPost}>
              <div className="community-compose-author">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="feed-composer-avatar" draggable={false} />
                ) : (
                  <div
                    className="feed-composer-avatar-placeholder"
                    style={{ backgroundColor: getUserAvatarColor(user?.id, profile?.name || user?.name) }}
                  >
                    {(profile?.name || user?.name)?.charAt(0) || 'Y'}
                  </div>
                )}
                <div className="community-compose-author-meta">
                  <strong>{profile?.name || user?.name || 'You'}</strong>
                  {composerFeeling && (
                    <span className="community-compose-feeling-chip">
                      {composerFeeling.emoji} Feeling {composerFeeling.label}
                      <button
                        type="button"
                        onClick={() => setComposerFeeling(null)}
                        aria-label="Remove feeling"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  )}
                </div>
              </div>

              <ProfileListbox
                label="Neighborhood"
                value={composerNeighborhood}
                options={COMMUNITY_NEIGHBORHOODS}
                placeholder="Select neighborhood"
                onChange={setComposerNeighborhood}
              />

              <textarea
                className="community-compose-textarea"
                value={composerContent}
                onChange={(event) => setComposerContent(event.target.value)}
                placeholder={prompt}
                rows={5}
                autoFocus
              />

              {composerPhotoPreview && (
                <div className="community-compose-photo-preview">
                  <img src={composerPhotoPreview} alt="Preview" />
                  <button
                    type="button"
                    className="feed-composer-photo-remove"
                    onClick={handleRemovePhoto}
                    aria-label="Remove photo"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <div className="community-compose-toolbar">
                <span className="community-compose-toolbar-label">Add to your post</span>
                <div className="community-compose-toolbar-actions">
                  <button
                    type="button"
                    className="community-compose-tool-btn"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <Image size={18} />
                    <span>Photo/video</span>
                  </button>
                  <div className="community-compose-feeling-wrap">
                    <button
                      type="button"
                      className={`community-compose-tool-btn${showFeelingPicker ? ' is-active' : ''}`}
                      onClick={() => setShowFeelingPicker((open) => !open)}
                    >
                      <Smile size={18} />
                      <span>Feeling/activity</span>
                    </button>
                    {showFeelingPicker && (
                      <div className="community-compose-feeling-panel">
                        {COMPOSER_FEELINGS.map((feeling) => (
                          <button
                            key={feeling.label}
                            type="button"
                            className={`community-compose-feeling-option${composerFeeling?.label === feeling.label ? ' is-selected' : ''}`}
                            onClick={() => {
                              setComposerFeeling(feeling);
                              setShowFeelingPicker(false);
                            }}
                          >
                            <span>{feeling.emoji}</span>
                            {feeling.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {showJobShortcut && (
                    <button
                      type="button"
                      className="community-compose-tool-btn community-compose-tool-btn--job"
                      onClick={handleCreateJobShortcut}
                    >
                      <Briefcase size={18} />
                      <span>Create Job</span>
                    </button>
                  )}
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  hidden
                />
              </div>

              <div className="community-compose-footer">
                <button
                  type="submit"
                  className="primary-button community-compose-submit"
                  disabled={submittingPost || (!composerContent.trim() && !composerPhoto)}
                >
                  {submittingPost ? 'Posting...' : 'Post'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
