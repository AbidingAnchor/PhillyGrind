import { useEffect, useState } from 'react';
import CategoryFilters from '../components/CategoryFilters.jsx';
import ListingCard from '../components/ListingCard.jsx';
import { jobCategories } from '../data/listings.js';
import { getListings } from '../lib/listingsApi.js';
import { attachPosterRatings } from '../lib/reviewsApi.js';

// Helper function to format salary in thousands
const formatSalary = (num) => {
  if (!num) return null;
  const k = Math.round(num / 1000);
  return `$${k}K`;
};

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
  const [jobs, setJobs] = useState([]);
  const [category, setCategory] = useState('All');
  const [keyword, setKeyword] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usingFallback, setUsingFallback] = useState(false);

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
          let salary = 'Salary not specified';
          
          if (min && max) {
            if (Math.abs(max - min) <= 1000) {
              salary = `Est. ${formatSalary(min)}`;
            } else {
              salary = `${formatSalary(min)} - ${formatSalary(max)}`;
            }
          } else if (min) {
            salary = `Est. ${formatSalary(min)}`;
          }

          return {
            id: job.id || crypto.randomUUID(),
            title: job.title,
            company: job.company?.display_name || job.company || 'Unknown Company',
            location: job.location?.display_name || job.location || 'Philadelphia, PA',
            salary,
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

        // Filter to only show jobs in Philadelphia or PA, exclude NJ
        const isPhilly = (loc) => {
          if (!loc || loc.trim() === '') return true;
          if (loc.includes('New Jersey') || loc.includes(', NJ')) return false;
          return loc.includes('Philadelphia') || loc.includes(', PA');
        };

        const selectedCat = CATEGORY_MAP[category];
        const isKeywordBased = selectedCat?.keyword && !selectedCat?.category;
        const isSecurity = category === 'Security';

        console.log('All job locations:', allJobs.map(j => j.location?.display_name));

        const filteredJobs = deduplicatedJobs.filter(job => {
          if (isKeywordBased || isSecurity) return true;
          return isPhilly(job.location || '');
        });

        if (filteredJobs.length === 0) {
          console.log('All APIs returned 0 results after filtering, falling back to Supabase');
          throw new Error('No results from external APIs');
        }

        console.log('Setting filtered jobs from all APIs:', filteredJobs.length);
        setJobs(filteredJobs);
        setLoading(false);
      } catch (err) {
        console.log('External APIs fetch failed, falling back to Supabase:', err.message);
        setUsingFallback(true);
        // Fallback to Supabase
        getListings('job', { keyword, category, neighborhood })
          .then(attachPosterRatings)
          .then((supabaseJobs) => {
            console.log('Supabase fallback jobs:', supabaseJobs);
            setJobs(supabaseJobs);
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
                <ListingCard key={job.id} listing={job} />
              )
            ))}
          </div>
          {!jobs.length && <p className="empty-state">No jobs match those filters yet.</p>}
        </>
      )}
    </section>
    </>
  );
}

export default BrowseJobs;
