import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CategoryFilters from '../components/CategoryFilters.jsx';
import ListingCard from '../components/ListingCard.jsx';
import QuickApplyModal from '../components/QuickApplyModal.jsx';
import StarRating from '../components/StarRating.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { jobCategories } from '../data/listings.js';
import { getListings, getFeaturedWorkers } from '../lib/listingsApi.js';
import { attachPosterRatings } from '../lib/reviewsApi.js';
import { useAuth } from '../lib/auth.jsx';
import { getUserAvatarColor } from '../lib/reactions.js';

// Helper function to format salary in thousands
const formatSalary = (num) => {
  if (!num) return null;
  const k = Math.round(num / 1000);
  return `$${k}K`;
};

const HOURS_PER_YEAR = 2080;

function toHourlyRate(annualSalary) {
  return Math.round(annualSalary / HOURS_PER_YEAR);
}

function formatJobSalary(min, max, { contract_time, salary_is_predicted } = {}) {
  if (!min) return 'Salary not specified';

  const minNum = Number(min);
  const maxNum = Number(max);
  const isPredicted = salary_is_predicted === 1 || salary_is_predicted === '1';
  const estimatedSuffix = isPredicted ? ' (est.)' : '';
  const contractTime = (contract_time || '').toLowerCase();
  const isHourlyContract = contractTime === 'part_time' || contractTime === 'contract';

  if (isHourlyContract) {
    if (maxNum) {
      return `~$${toHourlyRate(minNum)}-$${toHourlyRate(maxNum)}/hr${estimatedSuffix}`;
    }
    return `~$${toHourlyRate(minNum)}/hr${estimatedSuffix}`;
  }

  if (maxNum) {
    return `${formatSalary(minNum)}-${formatSalary(maxNum)}/yr${estimatedSuffix}`;
  }

  return `${formatSalary(minNum)}/yr${estimatedSuffix}`;
}

const GREATER_PHILLY_COUNTIES = [
  'Delaware County',
  'Montgomery County',
  'Gloucester County',
  'Burlington County',
  'Camden County',
];

const NJ_METRO_COUNTIES = [
  'Gloucester County',
  'Burlington County',
  'Camden County',
];

function isGreaterPhillyArea(loc) {
  if (!loc || loc.trim() === '') return true;

  if (GREATER_PHILLY_COUNTIES.some((county) => loc.includes(county))) {
    return true;
  }

  if (loc.includes('Philadelphia')) {
    return true;
  }

  if (loc.includes(', PA') || loc.includes('Pennsylvania')) {
    return true;
  }

  if (loc.includes(', NJ') || loc.includes('New Jersey')) {
    return NJ_METRO_COUNTIES.some((county) => loc.includes(county));
  }

  return false;
}

function deriveJobType(job) {
  if (job.job_type) return job.job_type;
  const text = `${job.title || ''} ${job.description || ''} ${job.snippet || ''}`.toLowerCase();
  if (/\bhybrid\b/.test(text)) return 'Hybrid';
  if (/\bremote\b|\bwork from home\b|\bwfh\b/.test(text)) return 'Remote';
  return 'In-person';
}

function applyClientFilters(jobs, { jobType, salaryMin, hideNoSalary }) {
  let result = jobs;
  if (jobType !== 'All') {
    result = result.filter((job) => job.job_type === jobType);
  }
  if (salaryMin) {
    const minSalary = Number(salaryMin);
    if (Number.isFinite(minSalary)) {
      result = result.filter((job) => job.salary_min >= minSalary);
    }
  }
  if (hideNoSalary) {
    result = result.filter((job) => job.salary !== 'Salary not specified');
  }
  return result;
}

// Map PhillyGrind categories to Adzuna category slugs or keywords
const CATEGORY_MAP = {
  Restaurant: { category: 'hospitality-catering-jobs', keyword: 'restaurant' },
  Retail: { category: 'retail-jobs' },
  Warehouse: { category: 'logistics-warehouse-jobs' },
  Healthcare: { category: 'healthcare-nursing-jobs' },
  'Customer Service': { keyword: 'customer service' },
  Security: { keyword: 'security guard' },
};

function BrowseJobs() {
  console.log('BrowseJobs component mounted');
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();
  const [fetchedJobs, setFetchedJobs] = useState([]);
  const [featuredWorkers, setFeaturedWorkers] = useState([]);
  const [category, setCategory] = useState('All');
  const [keyword, setKeyword] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [jobType, setJobType] = useState('All');
  const [salaryMin, setSalaryMin] = useState('');
  const [hideNoSalary, setHideNoSalary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [error, setError] = useState('');
  const [usingFallback, setUsingFallback] = useState(false);
  const [quickApplyJob, setQuickApplyJob] = useState(null);

  useEffect(() => {
    // Load featured workers (from Home.jsx)
    getFeaturedWorkers(4)
      .then((workers) => {
        setFeaturedWorkers(workers);
        setLoadingWorkers(false);
      })
      .catch((error) => {
        console.error('Failed to load featured workers:', error);
        setLoadingWorkers(false);
      });
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      console.log('BrowseJobs: Fetching jobs with filters:', { keyword, category, neighborhood });
      setLoading(true);
      setError('');
      setUsingFallback(false);

      // Get category config (category slug or keyword)
      const categoryConfig = CATEGORY_MAP[category];

      // Build params for APIs
      const params = new URLSearchParams();
      if (keyword) params.append('keyword', keyword);
      if (categoryConfig?.category) params.append('category', categoryConfig.category);
      if (categoryConfig?.keyword) params.append('keyword', categoryConfig.keyword);
      if (neighborhood) params.append('location', neighborhood);

      console.log('Fetching jobs from consolidated API with params:', params.toString());
      
      try {
        // Call consolidated jobs API (handles Adzuna, USAJobs, Jooble internally)
        const response = await fetch(`/api/jobs?${params.toString()}`);
        const data = await response.json();
        const allJobs = data.results || [];

        console.log('Consolidated API returned jobs:', allJobs.length);

        // Normalize all jobs to same format
        const normalizeJob = (job) => {
          const min = job.salary_min;
          const max = job.salary_max;
          const salary = formatJobSalary(min, max, {
            contract_time: job.contract_time,
            salary_is_predicted: job.salary_is_predicted,
          });

          return {
            id: job.id || crypto.randomUUID(),
            title: job.title,
            company: job.company?.display_name || job.company || 'Unknown Company',
            location: job.location?.display_name || job.location || 'Philadelphia, PA',
            salary,
            salary_min: min || 0,
            job_type: deriveJobType(job),
            description: job.description || job.snippet || 'No description available',
            url: job.redirect_url || job.url,
            isAdzuna: job.source === 'adzuna',
            source: job.source,
          };
        };

        const normalizedJobs = allJobs.map(normalizeJob);

        // Deduplicate by title+company
        const seen = new Set();
        const deduplicatedJobs = normalizedJobs.filter(job => {
          const key = `${job.title}-${job.company}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Filter to Greater Philadelphia metro area jobs
        const selectedCat = CATEGORY_MAP[category];
        const isKeywordBased = selectedCat?.keyword && !selectedCat?.category;
        const isSecurity = category === 'Security';

        console.log('All job locations:', allJobs.map(j => j.location?.display_name));

        const filteredJobs = deduplicatedJobs.filter(job => {
          if (isKeywordBased || isSecurity) return true;
          return isGreaterPhillyArea(job.location || '');
        });

        if (filteredJobs.length === 0) {
          console.log('All APIs returned 0 results after filtering, falling back to Supabase');
          throw new Error('No results from external APIs');
        }

        console.log('Setting filtered jobs from all APIs:', filteredJobs.length);
        setFetchedJobs(filteredJobs);
        setLoading(false);
      } catch (err) {
        console.log('External APIs fetch failed, falling back to Supabase:', err.message);
        setUsingFallback(true);
        // Fallback to Supabase
        getListings('job', { keyword, category, neighborhood })
          .then(attachPosterRatings)
          .then((supabaseJobs) => {
            console.log('Supabase fallback jobs:', supabaseJobs);
            const normalizedSupabaseJobs = supabaseJobs.map((job) => ({
              ...job,
              salary: job.salary || (job.pay ? job.pay : 'Salary not specified'),
              salary_min: job.salary_min || 0,
              job_type: deriveJobType(job),
            }));
            setFetchedJobs(normalizedSupabaseJobs);
            setLoading(false);
          })
          .catch((supabaseErr) => {
            console.error('Supabase fallback also failed:', supabaseErr);
            setError(supabaseErr.message || 'Could not load jobs from either source.');
            setLoading(false);
          });
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [category, keyword, neighborhood]);

  const jobs = useMemo(
    () => applyClientFilters(fetchedJobs, { jobType, salaryMin, hideNoSalary }),
    [fetchedJobs, jobType, salaryMin, hideNoSalary],
  );

  return (
    <>
      <section className="browse-hero jobs-hero">
        <span className="eyebrow">Browse jobs</span>
        <h1>Philadelphia job listings</h1>
        <p>Search and filter restaurant, retail, barbershop, warehouse, healthcare, and office opportunities.</p>
      </section>
      <section className="page-section browse-content">
      <div className="browse-controls">
        <label>
          Search jobs
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Search title or description"
          />
        </label>
        <label>
          Neighborhood
          <input
            value={neighborhood}
            onChange={(event) => setNeighborhood(event.target.value)}
            placeholder="South Philly, Fishtown, Center City..."
          />
        </label>
        <label>
          Job Type
          <select value={jobType} onChange={(event) => setJobType(event.target.value)}>
            <option value="All">All</option>
            <option value="Remote">Remote</option>
            <option value="Hybrid">Hybrid</option>
            <option value="In-person">In-person</option>
          </select>
        </label>
        <label>
          Minimum Salary
          <input
            type="number"
            value={salaryMin}
            onChange={(event) => setSalaryMin(event.target.value)}
            placeholder="e.g. 40000"
            min="0"
          />
        </label>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600' }}>
            <input
              type="checkbox"
              style={{ width: 'auto' }}
              checked={hideNoSalary}
              onChange={(e) => setHideNoSalary(e.target.checked)}
            />
            Hide jobs with no salary
          </label>
        </div>
      </div>
      <CategoryFilters categories={jobCategories} activeCategory={category} onChange={setCategory} />
      {loading && <p className="empty-state">Loading jobs...</p>}
      {error && <p className="empty-state error-state">{error}</p>}
      {!loading && !error && (
        <>
          {usingFallback && <p className="empty-state" style={{ color: '#f59e0b' }}>Showing local job listings (external API unavailable)</p>}
          <div className="listing-grid">
            {jobs.map((job) => (
              job.isAdzuna ? (
                <div key={job.id} className="listing-card adzuna-job-card">
                  <h3>{job.title}</h3>
                  <p className="listing-company">{job.company}</p>
                  <p className="listing-location">{job.location}</p>
                  {job.salary && job.salary !== 'Salary not specified' && <p className="listing-salary">{job.salary}</p>}
                  <p className="listing-description">{job.description?.substring(0, 150)}{job.description?.length > 150 ? '...' : ''}</p>
                  <a href={job.url} target="_blank" rel="noopener noreferrer" className="primary-button">View Job</a>
                </div>
              ) : (
                <ListingCard
                  key={job.id}
                  listing={job}
                  showQuickApply={usingFallback && job.user_id && !job.apply_url && (!isLoggedIn || job.user_id !== user?.id)}
                  onQuickApply={(selectedJob) => {
                    if (!isLoggedIn) {
                      navigate('/login', { state: { from: `/jobs/${selectedJob.id}` } });
                      return;
                    }
                    setQuickApplyJob(selectedJob);
                  }}
                />
              )
            ))}
          </div>
          {!jobs.length && (
            <EmptyState
              icon="jobs"
              title="No jobs match those filters yet"
              message="Try adjusting your filters or check back later."
            />
          )}
        </>
      )}
    </section>

    {/* Featured Workers Section (from Home.jsx) */}
    {!loadingWorkers && Boolean(featuredWorkers.length) && (
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
                <span 
                  className="featured-worker-avatar"
                  style={!worker.posterAvatarUrl ? { backgroundColor: getUserAvatarColor(worker.user_id, worker.posterName) } : undefined}
                >
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

    {quickApplyJob && (
      <QuickApplyModal
        listing={quickApplyJob}
        onClose={() => setQuickApplyJob(null)}
      />
    )}
    </>
  );
}

export default BrowseJobs;
