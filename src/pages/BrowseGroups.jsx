import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, PlusCircle, Users } from 'lucide-react';
import EmptyState from '../components/EmptyState.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { COMMUNITY_NEIGHBORHOODS } from '../lib/communityApi.js';
import { GROUP_CATEGORIES, listPublicGroups } from '../lib/groupsApi.js';

const DESCRIPTION_PREVIEW_LENGTH = 140;

function withTimeout(promise, milliseconds, message) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), milliseconds);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

function previewDescription(description) {
  const text = String(description || '').trim();
  if (!text) return '';
  if (text.length <= DESCRIPTION_PREVIEW_LENGTH) return text;
  return `${text.slice(0, DESCRIPTION_PREVIEW_LENGTH).trimEnd()}…`;
}

function BrowseGroups() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('All');
  const [neighborhood, setNeighborhood] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const hasActiveFilters = Boolean(keyword.trim() || (category && category !== 'All') || neighborhood);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      setLoading(true);
      setError('');

      async function loadGroups() {
        try {
          const nextGroups = await withTimeout(
            listPublicGroups({ keyword, category, neighborhood }),
            5000,
            'Supabase took too long to load groups. Please try again.',
          );
          if (!cancelled) setGroups(nextGroups);
        } catch (err) {
          if (!cancelled) setError(err.message || 'Could not load groups.');
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      loadGroups();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [keyword, category, neighborhood]);

  return (
    <section className="page-section groups-browse-page">
      <header className="group-create-hero groups-browse-hero">
        <span className="group-create-kicker">Groups</span>
        <h1>
          Find your <span>people</span>
        </h1>
        <p>Browse public groups across Philly — hobbies, blocks, parenting, and the rest of the hustle.</p>
      </header>

      <div className="groups-browse-filters">
        <div className="groups-browse-filters-top">
          <label>
            Search groups
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Search by name"
            />
          </label>
          <label>
            Neighborhood
            <select value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)}>
              <option value="">Any neighborhood</option>
              {COMMUNITY_NEIGHBORHOODS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <Link className="filter active groups-browse-create" to="/groups/create">
            <PlusCircle size={18} />
            Create a Group
          </Link>
        </div>

        <div className="groups-browse-categories" role="group" aria-label="Filter by category">
          {['All', ...GROUP_CATEGORIES].map((option) => (
            <button
              key={option}
              type="button"
              className={`filter groups-browse-category ${category === option ? 'active' : ''}`}
              onClick={() => setCategory(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="empty-state error-state">{error}</p>}
      {loading && <Skeleton variant="cards" />}

      {!loading && !error && (
        <>
          {groups.length > 0 && (
            <div className="groups-browse-grid">
              {groups.map((group) => {
                const memberCount = group.member_count ?? 0;
                const memberLabel = `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`;
                const description = previewDescription(group.description);
                const place = group.neighborhood || 'Philadelphia';

                return (
                  <Link
                    key={group.id}
                    className="groups-browse-card-link"
                    to={`/groups/${group.id}`}
                  >
                    <article className="group-create-postcard groups-browse-card">
                      <div className="group-create-postcard-cover" aria-hidden="true">
                        <span>{place}</span>
                      </div>
                      <div className="group-create-postcard-avatar" aria-hidden="true">
                        {(group.name || 'G').charAt(0).toUpperCase()}
                      </div>
                      <div className="group-create-postcard-body">
                        {group.category && (
                          <span className="group-create-category">{group.category}</span>
                        )}
                        <h3>{group.name}</h3>
                        {description && <p>{description}</p>}
                        <div className="listing-meta">
                          {group.neighborhood && (
                            <span>
                              <MapPin size={16} />
                              {group.neighborhood}
                            </span>
                          )}
                          <span>
                            <Users size={16} />
                            {memberLabel}
                          </span>
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          )}

          {!groups.length && (
            <div className="group-page-empty">
              <EmptyState
                icon="community"
                title={hasActiveFilters ? 'No groups match those filters' : 'No groups yet'}
                message={
                  hasActiveFilters
                    ? 'Try a different name, category, or neighborhood — or start the group you wish existed.'
                    : 'Be the first to start a public space for neighbors with the same hobby, block, or hustle.'
                }
                action
                actionLabel="Create a Group"
                onAction={() => navigate('/groups/create')}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default BrowseGroups;
