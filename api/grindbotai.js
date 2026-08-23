import { createRateLimiter, checkRateLimit } from './_utils/rateLimit.js';
import { createClient } from '@supabase/supabase-js';

const limiter = createRateLimiter(20, '60 s');
const MAX_TOOL_ROUNDS = 3;
const ACTIVITY_LIMIT = 6;
const USER_BUSY_MESSAGE = "I'm handling a lot right now — give me a second and try again.";
const USER_DOWN_MESSAGE = 'GrindBot is taking five. Try again in a minute.';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TICKET_CATEGORIES = new Set([
  'general',
  'data_deletion',
  'fair_housing_complaint',
  'dispute_report',
  'other',
]);

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

if (!process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL) {
  console.error('[GrindBot] Missing Supabase URL');
}

function sendJson(res, status, body) {
  res.status(status).json(body);
}

function looksLikeProviderLeak(text) {
  return /rate limit|tokens per|token.?limit|tpm\b|upgrade to|dev tier|groq|openai\/gpt-oss|billing|try again in \d|please reduce/i.test(String(text || ''));
}

function isRateLimitPayload(status, payload) {
  if (status === 429) return true;
  const message = payload?.error?.message || payload?.message || '';
  const code = payload?.error?.code || payload?.error?.type || '';
  return /rate_limit|too_many_requests/i.test(String(code)) || looksLikeProviderLeak(message);
}

function publicGrindBotError(error, status) {
  const message = error?.message || error;
  if (status === 429 || looksLikeProviderLeak(message)) {
    return USER_BUSY_MESSAGE;
  }
  return USER_DOWN_MESSAGE;
}

function requireMethod(req, res, method = 'POST') {
  if (req.method !== method) {
    sendJson(res, 405, { error: `Method ${req.method} not allowed.` });
    return false;
  }
  return true;
}

function getBearerToken(req) {
  return req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
}

async function getUserFromRequest(req) {
  const token = getBearerToken(req);
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;

  return data.user;
}

function parseToolArgs(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function sanitizeSearch(query) {
  return String(query || '')
    .replace(/[%_,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function isUuid(value) {
  return UUID_RE.test(String(value || ''));
}

function dollars(cents) {
  if (cents == null || Number.isNaN(Number(cents))) return null;
  return (Number(cents) / 100).toFixed(2);
}

function clip(value, max = 180) {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

function notFound() {
  return { error: 'not_found' };
}

const tools = [
  {
    type: 'function',
    function: {
      name: 'search_content',
      description: 'Search Community posts/comments by keyword.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_report',
      description: 'File a community post/comment report after the user confirms the match. Always files; never skip based on your own judgment.',
      parameters: {
        type: 'object',
        properties: {
          post_id: { type: 'string' },
          comment_id: { type: 'string' },
          reason: { type: 'string' },
          subreason: { type: 'string' },
        },
        required: ['reason', 'subreason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_activity',
      description: "Logged-in user's recent listings, bids, applications, and orders. No args.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_report_history',
      description: "Logged-in user's reports, tickets, and disputes. No args.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_order_status',
      description: 'One gig or marketplace order by UUID if the user is a party. Else not_found.',
      parameters: {
        type: 'object',
        properties: { order_id: { type: 'string' } },
        required: ['order_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_listings',
      description: 'Search live Jobs/Gigs/Marketplace/Housing. Not Community.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          category: { type: 'string' },
          neighborhood: { type: 'string' },
          type: { type: 'string', enum: ['all', 'job', 'gig', 'marketplace', 'housing'] },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_support_ticket',
      description: 'Queue a human support ticket after troubleshooting and explicit user confirm.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['general', 'data_deletion', 'fair_housing_complaint', 'dispute_report', 'other'],
          },
          message: { type: 'string' },
        },
        required: ['category', 'message'],
      },
    },
  },
];

async function searchContent(query) {
  const needle = sanitizeSearch(query);
  if (!needle) return [];

  const { data, error } = await supabase
    .from('community_posts')
    .select('id, content, created_at')
    .ilike('content', `%${needle}%`)
    .limit(5);

  if (error) throw error;
  return (data || []).map((post) => ({
    id: post.id,
    content: clip(post.content),
    created_at: post.created_at,
  }));
}

async function createReport({ post_id, comment_id, reason, subreason }, reporterId) {
  const { error } = await supabase
    .from('community_reports')
    .insert({
      post_id: isUuid(post_id) ? post_id : null,
      comment_id: isUuid(comment_id) ? comment_id : null,
      reporter_id: reporterId,
      reason: String(reason || '').slice(0, 200),
      subreason: String(subreason || '').slice(0, 500),
      status: 'pending',
    });
  if (error) throw error;
  return { success: true };
}

async function getUserActivity(uid) {
  const [
    jobs,
    gigs,
    marketplace,
    housing,
    bids,
    applications,
    gigOrdersAsHirer,
    gigOrdersAsWorker,
    marketAsBuyer,
    marketAsSeller,
  ] = await Promise.all([
    supabase.from('jobs').select('id,title,category,neighborhood,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabase.from('gigs').select('id,title,category,neighborhood,status,post_type,pay,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabase.from('marketplace_listings').select('id,title,category,neighborhood,status,price,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabase.from('housing_listings').select('id,title,neighborhood,status,monthly_rent,bedrooms,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabase.from('bids').select('id,listing_id,status,proposed_rate,created_at').eq('worker_id', uid).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabase.from('applications').select('id,job_id,status,created_at').eq('applicant_id', uid).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabase.from('orders').select('id,listing_id,status,amount,created_at,hirer_id,worker_id').eq('hirer_id', uid).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabase.from('orders').select('id,listing_id,status,amount,created_at,hirer_id,worker_id').eq('worker_id', uid).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabase.from('marketplace_orders').select('id,listing_id,status,amount,created_at,buyer_id,seller_id').eq('buyer_id', uid).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabase.from('marketplace_orders').select('id,listing_id,status,amount,created_at,buyer_id,seller_id').eq('seller_id', uid).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
  ]);

  const gigOrders = [...(gigOrdersAsHirer.data || []), ...(gigOrdersAsWorker.data || [])]
    .filter((order, index, list) => list.findIndex((item) => item.id === order.id) === index)
    .slice(0, ACTIVITY_LIMIT)
    .map((order) => ({
      id: order.id,
      type: 'gig_order',
      listing_id: order.listing_id,
      status: order.status,
      amount: dollars(order.amount),
      role: order.hirer_id === uid ? 'hirer' : 'worker',
      created_at: order.created_at,
    }));

  const marketplaceOrders = [...(marketAsBuyer.data || []), ...(marketAsSeller.data || [])]
    .filter((order, index, list) => list.findIndex((item) => item.id === order.id) === index)
    .slice(0, ACTIVITY_LIMIT)
    .map((order) => ({
      id: order.id,
      type: 'marketplace_order',
      listing_id: order.listing_id,
      status: order.status,
      amount: dollars(order.amount),
      role: order.buyer_id === uid ? 'buyer' : 'seller',
      created_at: order.created_at,
    }));

  return {
    jobs: jobs.data || [],
    gigs: gigs.data || [],
    marketplace_listings: marketplace.data || [],
    housing_listings: housing.data || [],
    bids: bids.data || [],
    applications: applications.data || [],
    gig_orders: gigOrders,
    marketplace_orders: marketplaceOrders,
  };
}

async function getReportHistory(uid) {
  const [community, listingReports, tickets, ownMarketOrders] = await Promise.all([
    supabase.from('community_reports').select('id,post_id,comment_id,reason,subreason,status,created_at').eq('reporter_id', uid).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabase.from('reports').select('id,reported_type,reported_id,listing_type,reason,status,created_at').eq('reporter_id', uid).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabase.from('contact_submissions').select('id,category,status,created_at,message').eq('user_id', uid).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabase.from('marketplace_orders').select('id').or(`buyer_id.eq.${uid},seller_id.eq.${uid}`),
  ]);

  let disputes = [];
  const orderIds = (ownMarketOrders.data || []).map((row) => row.id);
  if (orderIds.length) {
    const { data } = await supabase
      .from('disputes')
      .select('id,order_id,status,created_at,seller_evidence_deadline')
      .in('order_id', orderIds)
      .order('created_at', { ascending: false })
      .limit(ACTIVITY_LIMIT);
    disputes = data || [];
  }

  return {
    community_reports: community.data || [],
    listing_reports: listingReports.error ? [] : (listingReports.data || []),
    support_tickets: (tickets.data || []).map((ticket) => ({
      id: ticket.id,
      category: ticket.category,
      status: ticket.status,
      created_at: ticket.created_at,
      message: clip(ticket.message, 140),
    })),
    disputes,
  };
}

async function getOrderStatus(orderId, uid) {
  if (!isUuid(orderId)) return notFound();

  const { data: gigOrder } = await supabase
    .from('orders')
    .select('id,listing_id,status,amount,created_at,completed_at,released_at,hirer_id,worker_id')
    .eq('id', orderId)
    .or(`hirer_id.eq.${uid},worker_id.eq.${uid}`)
    .maybeSingle();

  if (gigOrder?.id) {
    return {
      type: 'gig_order',
      id: gigOrder.id,
      listing_id: gigOrder.listing_id,
      status: gigOrder.status,
      amount: dollars(gigOrder.amount),
      role: gigOrder.hirer_id === uid ? 'hirer' : 'worker',
      created_at: gigOrder.created_at,
      completed_at: gigOrder.completed_at,
      released_at: gigOrder.released_at,
    };
  }

  const { data: marketOrder } = await supabase
    .from('marketplace_orders')
    .select('id,listing_id,status,amount,created_at,buyer_id,seller_id')
    .eq('id', orderId)
    .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
    .maybeSingle();

  if (marketOrder?.id) {
    return {
      type: 'marketplace_order',
      id: marketOrder.id,
      listing_id: marketOrder.listing_id,
      status: marketOrder.status,
      amount: dollars(marketOrder.amount),
      role: marketOrder.buyer_id === uid ? 'buyer' : 'seller',
      created_at: marketOrder.created_at,
    };
  }

  return notFound();
}

async function searchTable({ table, columns, query, category, neighborhood, extraEq, extraNeq }) {
  let request = supabase
    .from(table)
    .select(columns)
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    .limit(8);

  if (category) request = request.ilike('category', category);
  if (neighborhood) request = request.ilike('neighborhood', neighborhood);
  if (extraEq) {
    Object.entries(extraEq).forEach(([key, value]) => {
      request = request.eq(key, value);
    });
  }
  if (extraNeq) {
    Object.entries(extraNeq).forEach(([key, value]) => {
      request = request.neq(key, value);
    });
  }

  const { data, error } = await request;
  if (error) {
    console.warn(`[search_listings] ${table}:`, error.message);
    return [];
  }
  return data || [];
}

async function searchListings({ query, category, neighborhood, type = 'all' }) {
  const needle = sanitizeSearch(query);
  if (!needle) return { listings: [] };

  const cat = sanitizeSearch(category);
  const hood = sanitizeSearch(neighborhood);
  const scope = ['job', 'gig', 'marketplace', 'housing'].includes(type) ? type : 'all';

  const searches = [];
  if (scope === 'all' || scope === 'job') {
    searches.push(
      searchTable({
        table: 'jobs_public',
        columns: 'id,title,category,neighborhood,pay,created_at',
        query: needle,
        category: cat,
        neighborhood: hood,
      }).then((rows) => rows.map((row) => ({ ...row, type: 'job', path: `/jobs/${row.id}` }))),
    );
  }
  if (scope === 'all' || scope === 'gig') {
    searches.push(
      searchTable({
        table: 'gigs_public',
        columns: 'id,title,category,neighborhood,pay,status,post_type,created_at',
        query: needle,
        category: cat,
        neighborhood: hood,
        extraEq: { status: 'open' },
      }).then((rows) => rows.map((row) => ({ ...row, type: 'gig', path: `/gigs/${row.id}` }))),
    );
  }
  if (scope === 'all' || scope === 'marketplace') {
    searches.push(
      searchTable({
        table: 'marketplace_listings',
        columns: 'id,title,category,neighborhood,price,status,created_at',
        query: needle,
        category: cat,
        neighborhood: hood,
        extraEq: { status: 'active' },
      }).then((rows) => rows.map((row) => ({ ...row, type: 'marketplace', path: `/marketplace/${row.id}` }))),
    );
  }
  if (scope === 'all' || scope === 'housing') {
    searches.push(
      searchTable({
        table: 'housing_listings_public',
        columns: 'id,title,neighborhood,monthly_rent,bedrooms,created_at',
        query: needle,
        neighborhood: hood,
      }).then((rows) => rows.map((row) => ({ ...row, type: 'housing', path: `/housing/${row.id}` }))),
    );
  }

  const groups = await Promise.all(searches);
  return { listings: groups.flat().slice(0, 16) };
}

async function createSupportTicket({ category, message }, uid) {
  const safeCategory = TICKET_CATEGORIES.has(category) ? category : 'general';
  const body = String(message || '').trim().slice(0, 4000);
  if (!body) throw new Error('A ticket message is required.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('name,email')
    .eq('id', uid)
    .maybeSingle();

  const { data, error } = await supabase
    .from('contact_submissions')
    .insert({
      name: profile?.name || 'Neighbor',
      email: profile?.email || '',
      category: safeCategory,
      message: body,
      user_id: uid,
      status: 'open',
    })
    .select('id,category,status,created_at')
    .single();

  if (error) throw error;
  return { success: true, ticket: data };
}

async function runTool(name, rawArgs, uid) {
  const args = parseToolArgs(rawArgs);

  switch (name) {
    case 'search_content':
      return searchContent(args.query);
    case 'create_report':
      return createReport(args, uid);
    case 'get_user_activity':
      return getUserActivity(uid);
    case 'get_report_history':
      return getReportHistory(uid);
    case 'get_order_status':
      return getOrderStatus(args.order_id, uid);
    case 'search_listings':
      return searchListings(args);
    case 'create_support_ticket':
      return createSupportTicket(args, uid);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

const systemPrompt = `
You are GrindBot, the official AI assistant for PhillyGrind — a free, local job and gig platform built specifically for Philadelphia neighborhoods. You are helpful, direct, empathetic, and have a friendly Philly personality. You know everything about PhillyGrind and help users get the most out of the platform.

Here is everything you know about PhillyGrind:

PLATFORM OVERVIEW: PhillyGrind connects Philadelphia-area workers, freelancers, and neighbors with people who need help. It's completely free to use. There are multiple sections: Community (social feed), Jobs (steady work), Gigs (one-time tasks), Marketplace (buy/sell items), and Housing (rentals).

JOBS SECTION: Jobs are steady work positions like part-time or full-time employment. Hirers post job openings with title, description, pay rate, neighborhood, and category. Workers can apply by messaging the poster directly. Jobs do NOT use bidding or escrow — payment is arranged directly between worker and hirer.

GIGS SECTION: Gigs are one-time tasks or services. Users can post a gig either as a worker offering a service, or as a hirer needing help. Gigs use a bidding system — workers submit a pitch explaining why they are the right person for the job. The hirer reviews all bids and accepts the best one.

BIDDING SYSTEM (Gigs only): When a worker sees a gig they want, they click Submit a Bid and write a short pitch. The hirer sees all bids with each worker's name and pitch. The hirer can Accept or Reject each bid. When a bid is accepted, all other bids are automatically rejected and the escrow payment is triggered.

ESCROW PAYMENTS (Gigs only): PhillyGrind uses Stripe to hold payments securely in escrow. Here is how it works: The hirer pays upfront when accepting a bid. The money is held securely by Stripe, not by PhillyGrind. The worker completes the job. The hirer has 72 hours to confirm completion. If the hirer does not respond within 72 hours, the funds are automatically released to the worker. PhillyGrind charges an 8% platform fee. The worker receives the remaining 92%.

SETTING UP PAYOUTS: Workers need to connect a bank account or debit card via Stripe Express before they can receive payments. This is done by clicking Set Up Payouts when posting a gig as a service provider. Personal financial information goes directly to Stripe — PhillyGrind never sees it.

MARKETPLACE SECTION: Users can buy and sell items locally. Listings include photos, price, condition (New, Like New, Good, Fair, Poor), category, and neighborhood. Secure Checkout holds payment in escrow until the buyer confirms receipt or auto-release. Cash-only listings are arranged directly through messaging.

HOUSING SECTION: Landlords can post rental listings with photos, rent amount, bedrooms, neighborhood, and amenities. Tenants can message landlords directly. No escrow is used — rental arrangements are made directly between parties.

COMMUNITY SECTION: A social feed where users can post updates, ask questions, and engage with neighbors. Posts can be liked and commented on. Users can filter posts by neighborhood to see content from their area.

NEIGHBORHOOD FILTERING: Jobs, Gigs, Marketplace, Housing, and Community posts can all be filtered by neighborhood. Users can select their neighborhood in their profile to see "Nearby" content. Neighborhoods served include: North Philly, South Philly, West Philly, Northeast Philly, Northwest Philly, Kensington, Fishtown, Germantown, Olney, Frankford, Mayfair, Wissinoming, Port Richmond, Roxborough, Manayunk, and surrounding areas.

MESSAGING: Users can message each other directly through the platform on any listing (Jobs, Gigs, Marketplace, Housing) and on Community posts. Messages are private between the two parties.

DISPUTES: Users have 48 hours after job completion to raise a dispute through the platform. PhillyGrind has final authority to resolve disputes and determine how escrow funds are released.

REVIEWS: After every completed gig, both the hirer and worker can rate each other. Ratings build reputation over time.

SAFETY AND TRUST: PhillyGrind does not verify users but has reviews, escrow protection (for gigs), and dispute resolution to protect both sides. Never move payment off platform for gigs — always use the built-in escrow. For marketplace and housing, meet in safe public places and trust your instincts.

ACCOUNT AND PRIVACY: User emails are never shown publicly. Only display names and neighborhoods are visible. Financial data is handled entirely by Stripe. Users can edit their profile including bio, skills, availability, and neighborhood.

BOOSTING: Users can boost their listings to make them more visible. Boosted listings appear higher in search results and get more views. Boosts are paid features.

CONTACT AND SUPPORT: Users can reach support through the Contact page chat with you (GrindBot). For issues that still need a human after troubleshooting, you can file a support ticket into the admin queue. Support email is support@phillygrind.work. There is also a "Submit a Ticket Instead" button on the Contact page.

HOW TO POST: To post a job, go to Jobs → Post a Job. To post a gig, go to Gigs → Post a Gig. To post marketplace item, go to Marketplace → Post Listing. To post housing, go to Housing → Post a Rental.

HOW TO APPLY: For jobs, click the listing and message the poster directly. For gigs, click Submit a Bid and write your pitch. For marketplace/housing, message the seller/landlord directly.

COMMUNICATION STYLE:
Talk like a real person having a normal conversation, not like customer-service copy. Use contractions, casual phrasing, and a genuine Philly tone — the way a helpful local friend would explain something, not a corporate FAQ. Avoid stiff phrases like "I understand your concern" or "Thank you for reaching out." Keep responses direct and warm, not padded with filler. Always answer the specific question asked by the user — don't repeat information from previous messages unless it's directly relevant to their current question.

RESPONSE FORMAT:
- Keep answers short by default: 2-4 sentences for most questions
- Use numbered lists only for genuine step-by-step processes, and limit to 3-4 items max
- No markdown tables — explain things in plain text
- Sound like you're texting back, not writing documentation
- Offer to go deeper only if the user asks for more detail ("Want me to break that down further?")

SUPPORT STYLE:
When someone is frustrated or stuck, lead with a real acknowledgment in one short sentence — not scripted CS language. Then troubleshoot. Do not dump a feature FAQ.

TROUBLESHOOT FIRST (CRITICAL):
1. Acknowledge the situation.
2. Ask one clarifying question if you don't have enough to look anything up (which listing, gig vs marketplace, about when).
3. Use tools on THEIR data: get_user_activity, get_order_status, get_report_history, search_listings, search_content as relevant. Do not guess their order/listing IDs if the tools can find them.
4. Tell them what you actually found and the next concrete step (e.g. confirm receipt on the order page, wait for the 72-hour escrow release, message the other party, check Stripe payouts).
5. Only AFTER that attempt, if they still need a human, offer a ticket as: "Here's what I'd try — if that doesn't fix it, I can get this in front of a real person." Do not open with a ticket. Do not call create_support_ticket or create_report until they clearly confirm.

EXCEPTIONS (still not a moderation verdict):
Threats, ongoing danger, or clear illegal activity: skip the long troubleshoot loop, take it seriously, and offer to file a ticket/report immediately after a brief confirm of what to file. Ordinary "this feels scammy" or payment confusion should still check their actual order/listing first.

REPORT HANDLING:
When a user wants to report a post or comment:
1. Use search_content to find it based on what they describe.
2. Show them what you found and ask them to confirm it's the right one before doing anything else.
3. Once confirmed, ALWAYS call create_report — this is not optional and does not depend on your own opinion of whether it's a violation. Every confirmed report gets filed, no exceptions.
4. When discussing what the content might involve, you can reference our Terms of Service / Community Guidelines informationally (e.g. "this looks like it could relate to our harassment policy"), but never state a final verdict like "this does/doesn't violate our rules." You are not the one who decides — a human moderator reviews every report and makes that call. Frame it as "I've filed this for our support team to look into" every time, not conditionally.

TOOLS:
- search_content: Community posts/comments only.
- search_listings: live Jobs/Gigs/Marketplace/Housing.
- get_user_activity: their listings/orders/bids.
- get_order_status: one order they belong to.
- get_report_history: their reports/tickets/disputes.
- create_report: community post/comment, confirm first.
- create_support_ticket: non-content human queue, confirm first, last resort.
Never claim you looked something up unless you called the tool. If a tool returns not_found or empty, say you couldn't find anything on their account — do not invent records.

KEY RULES (use these instead of quoting a full legal dump):
Must be 18+. PhillyGrind connects people — it does not employ workers, own listings, or guarantee outcomes. Community: no harassment, doxxing, spam, illegal content. Jobs/gigs: no discriminatory hiring, MLM, or unpaid labor dressed up as paid. Marketplace: no weapons/drugs/stolen goods; Secure Checkout is 8% with escrow. Housing must follow Fair Housing / Philly source-of-income rules. You never decide violations; humans review reports. Emails stay private. Support: support@phillygrind.work.
`;

export default async function handler(req, res) {
  if (!requireMethod(req, res)) return;

  const identifier = req.headers['x-forwarded-for'] || 'anonymous';
  if (!(await checkRateLimit(limiter, identifier, res))) return;

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }

    if (!process.env.GROQ_API_KEY) {
      sendJson(res, 500, { error: USER_DOWN_MESSAGE });
      return;
    }

    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const safeMessages = messages
      .filter((message) => ['user', 'assistant'].includes(message.role) && String(message.content || '').trim())
      .slice(-8)
      .map((message) => ({
        role: message.role,
        content: String(message.content).slice(0, 3200),
      }));

    if (!safeMessages.length) {
      sendJson(res, 400, { error: 'A message is required.' });
      return;
    }

    let currentMessages = [
      { role: 'system', content: systemPrompt },
      ...safeMessages,
    ];

    async function callGroq(messages, includeTools = true, attempt = 0) {
      const requestBody = {
        model: 'openai/gpt-oss-120b',
        temperature: 0.5,
        max_tokens: 700,
        messages,
        ...(includeTools ? { tools } : {}),
      };

      const response = await fetch(GROQ_CHAT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const payload = await response.json().catch(() => ({}));
      if (payload?.usage) {
        console.log('[GrindBot] groq usage', payload.usage);
      }

      if (!response.ok) {
        const rateLimited = isRateLimitPayload(response.status, payload);
        const retryAfter = Number(response.headers.get('retry-after'));
        if (rateLimited && attempt === 0 && retryAfter > 0 && retryAfter <= 3) {
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000 + 150));
          return callGroq(messages, includeTools, 1);
        }
        console.error('[GrindBot API] Groq API error', {
          status: response.status,
          remainingTokens: response.headers.get('x-ratelimit-remaining-tokens'),
          resetTokens: response.headers.get('x-ratelimit-reset-tokens'),
        });
        const err = new Error(rateLimited ? USER_BUSY_MESSAGE : USER_DOWN_MESSAGE);
        err.status = rateLimited ? 429 : 503;
        throw err;
      }

      return payload;
    }

    let payload = await callGroq(currentMessages, true);
    let toolCalls = payload.choices?.[0]?.message?.tool_calls;
    let rounds = 0;

    while (toolCalls?.length && rounds < MAX_TOOL_ROUNDS) {
      rounds += 1;
      const toolMessages = [];

      for (const toolCall of toolCalls) {
        const name = toolCall.function?.name;
        let result;
        try {
          console.log('[GrindBot] tool', name, 'uid', user.id);
          result = await runTool(name, toolCall.function?.arguments, user.id);
        } catch (error) {
          result = { error: error.message || 'Tool failed.' };
        }

        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result).slice(0, 4000),
        });
      }

      currentMessages.push(payload.choices[0].message);
      currentMessages.push(...toolMessages);

      const keepTools = rounds < MAX_TOOL_ROUNDS;
      payload = await callGroq(currentMessages, keepTools);
      toolCalls = payload.choices?.[0]?.message?.tool_calls;
    }

    const reply = String(payload.choices?.[0]?.message?.content || '').trim();
    if (!reply || looksLikeProviderLeak(reply)) {
      if (looksLikeProviderLeak(reply)) {
        console.error('[GrindBot API] Sanitized leaked provider text from model reply');
      } else {
        console.error('[GrindBot API] No reply in Groq response');
      }
      sendJson(res, looksLikeProviderLeak(reply) ? 429 : 500, {
        error: looksLikeProviderLeak(reply) ? USER_BUSY_MESSAGE : USER_DOWN_MESSAGE,
      });
      return;
    }

    sendJson(res, 200, { reply });
  } catch (error) {
    const status = error.status === 429 ? 429 : 500;
    sendJson(res, status, { error: publicGrindBotError(error, error.status) });
  }
}
