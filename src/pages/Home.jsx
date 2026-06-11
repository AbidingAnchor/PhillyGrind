import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, Hammer, Search } from 'lucide-react';
import ListingCard from '../components/ListingCard.jsx';
import StarRating from '../components/StarRating.jsx';
import { getFeaturedWorkers, getListings } from '../lib/listingsApi.js';

const FALLBACK_OPPORTUNITY_COUNT = 1000;

function resolveOpportunityCount(count) {
  const value = Number(count);
  if (!Number.isFinite(value) || value <= 0) {
    return FALLBACK_OPPORTUNITY_COUNT;
  }
  return value;
}

function formatSalaryAmount(num) {
  if (!num) return null;
  const k = Math.round(num / 1000);
  return `$${k}K`;
}

function formatSalary(job) {
  const min = Number(job.salary_min);
  const max = Number(job.salary_max);

  if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max > 0) {
    if (Math.abs(max - min) <= 1000) {
      return `Est. ${formatSalaryAmount(min)}`;
    }
    return `${formatSalaryAmount(min)} - ${formatSalaryAmount(max)}`;
  }

  if (Number.isFinite(min) && min > 0) {
    return `Est. ${formatSalaryAmount(min)}`;
  }

  if (Number.isFinite(max) && max > 0) {
    return `Up to ${formatSalaryAmount(max)}`;
  }

  return 'Salary not listed';
}

function formatLocation(job) {
  return job.location?.display_name || job.location || 'Philadelphia, PA';
}

function AnimatedStat({ value }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const target = Math.max(value, 0);
    const duration = 900;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }, [value]);

  return <strong>{count.toLocaleString()}+</strong>;
}

function Home() {
  const [query, setQuery] = useState('');
  const [featuredJobs, setFeaturedJobs] = useState([]);
  const [featuredGigs, setFeaturedGigs] = useState([]);
  const [featuredWorkers, setFeaturedWorkers] = useState([]);
  const [recentGig, setRecentGig] = useState(null);
  const [recentAdzunaJob, setRecentAdzunaJob] = useState(null);
  const [opportunityCount, setOpportunityCount] = useState(FALLBACK_OPPORTUNITY_COUNT);
  const [featuredError, setFeaturedError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getListings('job'), getListings('gig'), getFeaturedWorkers(4)])
      .then(([jobs, gigs, workers]) => {
        setFeaturedJobs(jobs.slice(0, 2));
        setFeaturedGigs(gigs.slice(0, 2));
        setRecentGig(gigs[0] || null);
        setFeaturedWorkers(workers);
      })
      .catch((error) => setFeaturedError(error.message || 'Could not load featured listings.'));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAdzunaJobs() {
      try {
        const response = await fetch('/api/jobs');
        const contentType = response.headers.get('content-type') || '';
        const rawBody = await response.text();
        const payload = contentType.includes('application/json')
          ? JSON.parse(rawBody)
          : { results: [], count: 0 };

        if (!response.ok) {
          throw new Error(payload.error || 'Could not load jobs.');
        }

        if (cancelled) return;

        setOpportunityCount(resolveOpportunityCount(payload.count));
        setRecentAdzunaJob(payload.results?.[0] || null);
      } catch (error) {
        console.warn(error);
        if (!cancelled) {
          setOpportunityCount(FALLBACK_OPPORTUNITY_COUNT);
          setRecentAdzunaJob(null);
        }
      }
    }

    loadAdzunaJobs();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleSearch(event) {
    event.preventDefault();
    const destination = query.toLowerCase().includes('gig') ? '/gigs' : '/jobs';
    navigate(destination);
  }

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow">Philadelphia work starts here</span>
          <h1>Find steady jobs and quick gigs across Philly.</h1>
          <p>
            PhillyGrind connects local businesses, neighbors, and workers from South Philly to Germantown with practical work opportunities.
          </p>
          <form className="search-bar" onSubmit={handleSearch}>
            <Search size={20} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search restaurant jobs, moving gigs, warehouse shifts..."
            />
            <button type="submit">Search</button>
          </form>
          <div className="hero-actions">
            <Link className="primary-button" to="/jobs">Find a Job</Link>
            <Link className="secondary-button" to="/gigs">Find a Gig</Link>
          </div>
        </div>

        <div className="hero-panel">
          <div className="stat-card">
            <AnimatedStat value={opportunityCount} />
            <span>Local opportunities</span>
          </div>

          {recentAdzunaJob ? (
            <a
              className="route-card hero-listing-card"
              href={recentAdzunaJob.redirect_url}
              target="_blank"
              rel="noreferrer"
            >
              <span>Most recent job</span>
              <strong>{recentAdzunaJob.title}</strong>
              <p>{formatSalary(recentAdzunaJob)} · {formatLocation(recentAdzunaJob)}</p>
            </a>
          ) : (
            <Link className="route-card hero-listing-card" to="/philly-jobs">
              <span>Most recent job</span>
              <strong>Loading Philly jobs</strong>
              <p>Pulling current listings from Adzuna.</p>
            </Link>
          )}

          {recentGig ? (
            <Link className="route-card hero-listing-card" to={`/gigs/${recentGig.id}`}>
              <span>Most recent gig</span>
              <strong>{recentGig.title}</strong>
              <p>{recentGig.pay} · {recentGig.neighborhood}</p>
            </Link>
          ) : (
            <Link className="route-card hero-listing-card" to="/post-gig">
              <span>Most recent gig</span>
              <strong>No gigs posted yet</strong>
              <p>Post a task for the neighborhood.</p>
            </Link>
          )}
        </div>
      </section>

      <section className="split-section">
        <div className="section-heading">
          <span className="icon-chip"><BriefcaseBusiness size={18} /></span>
          <h2>Find a Job</h2>
          <p>Browse full-time, part-time, and shift-based roles from Philly employers.</p>
        </div>
        {featuredError && <p className="empty-state error-state">{featuredError}</p>}
        {!featuredError && Boolean(featuredJobs.length) && (
          <div className="listing-grid compact">
            {featuredJobs.map((job) => <ListingCard key={job.id} listing={job} />)}
          </div>
        )}
        {!featuredError && !featuredJobs.length && <p className="empty-state">No jobs posted yet.</p>}
        <Link className="section-link" to="/jobs">Browse all jobs <ArrowRight size={17} /></Link>
      </section>

      {Boolean(featuredWorkers.length) && (
        <section className="split-section featured-workers-section">
          <div className="section-heading">
            <span className="icon-chip">⭐</span>
            <h2>Featured Workers</h2>
            <p>Pro boosted Philly workers ready to get hired.</p>
          </div>
          <div className="featured-workers-grid">
            {featuredWorkers.map((worker) => {
              const initials = worker.posterName
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((word) => word[0])
                .join('')
                .toUpperCase();

              return (
                <Link className="featured-worker-card" key={worker.id} to={`/gigs/${worker.id}`}>
                  <span className="featured-worker-avatar">
                    {worker.posterAvatarUrl ? <img src={worker.posterAvatarUrl} alt={`${worker.posterName} profile`} /> : initials}
                  </span>
                  <div>
                    <span className="boost-badge pro">⭐ Pro</span>
                    <h3>{worker.posterName}</h3>
                    <StarRating rating={worker.posterRating?.average} count={worker.posterRating?.count} compact />
                    <p>{worker.title}</p>
                    <strong>{worker.pay} · {worker.neighborhood}</strong>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="split-section gig-band">
        <div className="section-heading">
          <span className="icon-chip"><Hammer size={18} /></span>
          <h2>Find a Gig</h2>
          <p>Pick up one-time tasks, same-day help, and neighborhood side work.</p>
        </div>
        {featuredError && <p className="empty-state error-state">{featuredError}</p>}
        {!featuredError && Boolean(featuredGigs.length) && (
          <div className="listing-grid compact">
            {featuredGigs.map((gig) => <ListingCard key={gig.id} listing={gig} />)}
          </div>
        )}
        {!featuredError && !featuredGigs.length && <p className="empty-state">No gigs posted yet.</p>}
        <Link className="section-link" to="/gigs">Browse all gigs <ArrowRight size={17} /></Link>
      </section>
    </>
  );
}

export default Home;
