import { requireMethod, sendJson, supabaseAdmin } from './_utils.js';


const ADZUNA_ENDPOINT = 'https://api.adzuna.com/v1/api/jobs/us/search/1';
const DEFAULT_APP_ID = '99927e9b';
const DEFAULT_APP_KEY = 'd379aca384a966fd906906f2323ea9d6';

async function handleBidCounts(req, res) {
  const listingIds = [...new Set((req.body?.listing_ids ?? []).filter(Boolean))];
  if (!listingIds.length) {
    sendJson(res, 200, { counts: {} });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('bids')
    .select('listing_id')
    .in('listing_id', listingIds)
    .neq('status', 'rejected');

  if (error) throw error;

  const counts = (data ?? []).reduce((nextCounts, bid) => ({
    ...nextCounts,
    [bid.listing_id]: (nextCounts[bid.listing_id] || 0) + 1,
  }), {});

  sendJson(res, 200, { counts });
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST' && req.query.action === 'bid-counts') {
      if (!requireMethod(req, res, 'POST')) return;
      await handleBidCounts(req, res);
      return;
    }

    if (req.method !== 'GET') {
      sendJson(res, 405, { error: `Method ${req.method} not allowed.` });
      return;
    }

    const { keyword = '', category = '', location = '' } = req.query;

  // Call all three APIs in parallel
  const [adzunaRes, usajobsRes, joobleRes] = await Promise.allSettled([
    fetchAdzuna(keyword, category, location),
    fetchUSAJobs(keyword, category),
    fetchJooble(keyword, category),
  ]);

  const adzunaData = adzunaRes.status === 'fulfilled' ? adzunaRes.value : { jobs: [], count: 0 };
  const usajobsJobs = usajobsRes.status === 'fulfilled' ? usajobsRes.value : [];
  const joobleJobs = joobleRes.status === 'fulfilled' ? joobleRes.value : [];
  const adzunaJobs = adzunaData.jobs || [];

  console.log('Adzuna results:', adzunaJobs.length);
  console.log('Jooble results:', joobleJobs.length);
  console.log('USAJobs results:', usajobsJobs.length);

    const allJobs = [...adzunaJobs, ...usajobsJobs, ...joobleJobs];
    sendJson(res, 200, { results: allJobs, count: adzunaData.count || 0 });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Jobs request failed.' });
  }
}

async function fetchAdzuna(keyword, category, location) {
  const appId = process.env.ADZUNA_APP_ID || DEFAULT_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY || DEFAULT_APP_KEY;

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    where: location || 'Philadelphia',
    results_per_page: '50',
    'content-type': 'application/json',
  });

  if (keyword) {
    params.append('what', keyword);
  }

  if (category && category !== 'All') {
    params.append('category', category);
  }

  const url = `${ADZUNA_ENDPOINT}?${params.toString()}`;
  console.log('Adzuna API call URL:', url);
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'PhillyGrind/1.0 (+https://phillygrind.work)',
    },
  });

  console.log('Adzuna API response status:', response.status);
  const contentType = response.headers.get('content-type') || '';
  const rawBody = await response.text();
  console.log('Adzuna API raw body:', rawBody);
  let payload = null;

  if (contentType.includes('application/json')) {
    try {
      payload = JSON.parse(rawBody);
      console.log('Adzuna API parsed payload:', payload);
    } catch (parseError) {
      console.error('Adzuna API JSON parse error:', parseError);
      return { jobs: [], count: 0 };
    }
  } else {
    console.error('Adzuna API non-JSON response, content-type:', contentType);
    return { jobs: [], count: 0 };
  }

  if (!response.ok) {
    console.error('Adzuna API error response:', payload);
    return { jobs: [], count: 0 };
  }

  return {
    count: payload.count || 0,
    jobs: (payload.results || []).map((job) => ({
    id: job.id,
    title: job.title,
    company: { display_name: job.company?.display_name || job.company || 'Unknown Company' },
    location: { display_name: job.location?.display_name || job.location || 'Philadelphia, PA' },
    salary_min: job.salary_min || 0,
    salary_max: job.salary_max || 0,
    description: job.description || job.snippet || 'No description available',
    redirect_url: job.redirect_url || job.url,
    source: 'adzuna',
  })),
  };
}

async function fetchUSAJobs(keyword, category) {
  const searchTerm = keyword || category || 'jobs';
  const url = `https://data.usajobs.gov/api/search?Keyword=${encodeURIComponent(searchTerm)}&LocationName=Philadelphia%2C%20Pennsylvania&ResultsPerPage=50`;
  
  const response = await fetch(url, {
    headers: {
      'Host': 'data.usajobs.gov',
      'User-Agent': 'drewnegron95@gmail.com',
      'Authorization-Key': ''
    }
  });
  
  const data = await response.json();
  return (data.SearchResult?.SearchResultItems || []).map(item => {
    const job = item.MatchedObjectDescriptor;
    return {
      id: job.PositionID,
      title: job.PositionTitle,
      company: { display_name: job.OrganizationName },
      location: { display_name: `${job.PositionLocationDisplay}` },
      salary_min: parseFloat(job.PositionRemuneration?.[0]?.MinimumRange || 0),
      salary_max: parseFloat(job.PositionRemuneration?.[0]?.MaximumRange || 0),
      description: job.UserArea?.Details?.JobSummary || '',
      redirect_url: job.PositionURI,
      source: 'usajobs'
    };
  });
}

async function fetchJooble(keyword, category) {
  const searchTerm = keyword || category || 'jobs';
  
  const response = await fetch(`https://jooble.org/api/${process.env.JOOBLE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keywords: searchTerm,
      location: 'Philadelphia, PA',
      radius: '25',
      resultsOnPage: 50
    })
  });
  
  const data = await response.json();
  return (data.jobs || []).map(job => ({
    id: job.id,
    title: job.title,
    company: { display_name: job.company || 'Unknown' },
    location: { display_name: job.location },
    salary_min: 0,
    salary_max: 0,
    description: job.snippet || '',
    redirect_url: job.link,
    source: 'jooble'
  }));
}
