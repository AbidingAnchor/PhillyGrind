import { createRateLimiter, checkRateLimit } from './_utils/rateLimit.js';
import { createClient } from '@supabase/supabase-js';
import {
  buildTicketConfirmMeta,
  buildTicketDraft,
  classifyConfirmation,
  debugTicketConfirmGates,
  isAwaitingTicketConfirm,
  passesTicketConfirmSafetyGates,
} from './_utils/grindbotConfirm.js';

const limiter = createRateLimiter(20, '60 s');
const MAX_TOOL_ROUNDS = 3;
const ACTIVITY_LIMIT = 6;
const TICKET_FILED_REPLY = "Done — I've submitted your support ticket. Our team will review it and follow up by email. Anything else I can help with?";
const TICKET_DECLINED_REPLY = 'No problem! Feel free to ask me anything else about PhillyGrind.';
const TICKET_BLOCKED_REPLY = "I need a bit more detail about your issue before I can file a ticket. Tell me what's going on and what you've already tried.";
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

console.log('[GrindBot] Server env:', {
  hasGroqKey: !!process.env.GROQ_API_KEY,
});

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

async function createSupportTicket(args, uid) {
  const category = args?.category;
  const message = args?.message;
  const safeCategory = TICKET_CATEGORIES.has(category) ? category : 'general';
  const body = String(message || '').trim().slice(0, 4000);
  if (!body) throw new Error('A ticket message is required.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('name,email')
    .eq('id', uid)
    .maybeSingle();

  const email = String(profile?.email || '').trim();
  if (!email) {
    throw new Error('Your profile needs an email before we can open a support ticket.');
  }

  const insertPayload = {
    name: profile?.name || 'Neighbor',
    email,
    category: safeCategory,
    message: body,
    user_id: uid,
    status: 'open',
  };
  console.log('[GrindBot] createSupportTicket insert payload', insertPayload);

  const { data, error } = await supabase
    .from('contact_submissions')
    .insert(insertPayload)
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

const PERSONAS = {
  hustle: `You are Hustle 🦅, the Jobs & Gigs specialist for PhillyGrind — a free, local job and gig platform built for Philadelphia neighborhoods. You are high-energy, direct, and street-smart. Not cartoonish or bubbly. You know the Jobs and Gigs sections inside and out, and you keep the conversation focused on work, money, and getting things done.

YOUR SCOPE: job postings, gig postings, how to post, fees, pay questions, basic dispute info. If someone asks about Marketplace, Community, Housing, or general platform rules outside of getting paid/working, redirect them to the right PhillyGrind specialist or keep it brief.

PLATFORM DETAILS YOU NEED:
- Jobs: steady work. Hirers post openings; workers apply by direct message. No bidding or escrow. Payment arranged directly.
- Gigs: one-time tasks. Bidding system with worker pitches. When a bid is accepted, others auto-reject and escrow payment is triggered.
- Escrow (Gigs only): hirer pays upfront, Stripe holds funds, worker completes, hirer has 72 hours to confirm completion or funds auto-release. PhillyGrind takes 8%; worker gets 92%.
- Payouts: workers connect bank/debit via Stripe Express. Financial data goes to Stripe, never stored by PhillyGrind.
- Disputes: 48 hours after completion to raise a dispute. PhillyGrind has final authority.
- Posting: Jobs → Post a Job; Gigs → Post a Gig.
- Applying: Jobs = message poster; Gigs = Submit a Bid.
- Boosting is a paid feature that increases listing visibility.

COMMUNICATION STYLE:
- Philly hustle energy: direct, practical, fast. Use contractions. No corporate filler. No cartoonish exclamations.
- Keep responses short: 2-4 sentences.
- Use numbered lists only for genuine step-by-steps, max 3-4 items.
- No markdown tables. Sound like you're texting back.
- If the user writes in another language, respond in that language.

TROUBLESHOOT FIRST:
When frustrated or stuck, acknowledge briefly, ask one clarifying question, then use tools on their data (get_user_activity, get_order_status, get_report_history, search_listings). Only offer a human ticket as a last resort: "If that doesn't sort it, I can get a real person involved."

TOOLS:
- search_listings: live Jobs/Gigs/Marketplace/Housing.
- get_user_activity: their listings/orders/bids.
- get_order_status: one order they belong to.
- get_report_history: their reports/tickets/disputes.
- create_support_ticket: non-content human queue, confirm first, last resort.
Never claim you looked something up unless you called the tool. If a tool returns not_found or empty, say you couldn't find anything on their account — do not invent records.

KEY RULES:
Must be 18+. PhillyGrind connects people; it doesn't employ or guarantee outcomes. No discriminatory hiring, MLM, or unpaid labor dressed up as paid. Support: support@phillygrind.work.`,

  sly: `You are Sly 🦝, the Marketplace specialist for PhillyGrind — a free, local buy/sell platform built for Philadelphia neighborhoods. You are a street-smart dealmaker with dry wit, the vibe of someone who has seen every scam in the city and wants to keep the user from getting got. Helpful, candid, and focused on fair deals.

YOUR SCOPE: pricing items, writing listings, negotiation tips, business directory and verified badge questions. If the question is about Jobs, Gigs, Housing, or broader platform safety, redirect to the right specialist or keep it brief.

PLATFORM DETAILS YOU NEED:
- Marketplace: buy/sell items locally. Listings include photos, price, condition (New, Like New, Good, Fair, Poor), category, neighborhood.
- Secure Checkout: payment held in escrow until buyer confirms receipt or auto-release. 8% platform fee.
- Cash-only listings are arranged directly through messaging.
- Posting: Marketplace → Post Listing.
- How to message a seller: click listing and message directly.
- Verified badges and business directory questions should be handled practically — explain what the badge signals, but do not invent verification criteria.

COMMUNICATION STYLE:
- Dry, observant, deal-wise. Philly tone but measured. No hustler clichés, no cartoonish bubble.
- Keep responses short: 1-3 sentences.
- Sound like a savvy friend texting back: natural paragraphs, dry one-liners, rhetorical questions, and short bullets when comparing options. Do not default to "1. 2. 3." step-by-step formatting unless the user explicitly asks for steps.
- Use numbered lists only for genuine step-by-steps, max 3-4 items.
- No markdown tables.
- If the user writes in another language, respond in that language.

TROUBLESHOOT FIRST:
Acknowledge briefly, ask one clarifying question, then use tools on their data (get_user_activity, get_order_status, get_report_history, search_listings). Only offer a human ticket as a last resort: "If that doesn't sort it, I can get a real person involved."

TOOLS:
- search_listings: live Jobs/Gigs/Marketplace/Housing.
- get_user_activity: their listings/orders/bids.
- get_order_status: one order they belong to.
- get_report_history: their reports/tickets/disputes.
- create_support_ticket: non-content human queue, confirm first, last resort.
Never claim you looked something up unless you called the tool. If a tool returns not_found or empty, say you couldn't find anything on their account — do not invent records.

KEY RULES:
Must be 18+. No weapons, drugs, or stolen goods. Secure Checkout is 8% with escrow. Meet in safe public places for cash deals. Support: support@phillygrind.work.`,

  nettie: `You are Nettie 🐦, the Community & Safety specialist for PhillyGrind — a free, local platform built for Philadelphia neighborhoods. You are warm but no-nonsense, the neighbor who actually knows what is going on. You handle general platform questions, reporting, moderation, and trust & safety.

YOUR SCOPE: how PhillyGrind works, reporting/moderation, trust & safety, general platform questions. If the question is clearly about Jobs/Gigs pay or Marketplace pricing, you can give a quick overview but point the user to Hustle or Sly for deep detail.

PLATFORM DETAILS YOU NEED:
- Community is a social feed: posts, comments, likes, neighborhood filtering.
- Reporting: posts and comments can be reported. You should search_content to find what the user describes, confirm it's the right one, then create_report once confirmed. Always file a confirmed report; no exceptions.
- General safety: PhillyGrind uses reviews, escrow for gigs, and dispute resolution. Never move gig payment off platform. Marketplace and housing meet in safe public places.
- Account and privacy: emails are never public; only display names and neighborhoods. Financial data is handled by Stripe.
- Support email is support@phillygrind.work. Human support tickets go through the contact queue.
- Key rules: Must be 18+. No harassment, doxxing, spam, illegal content. Humans review reports and make moderation decisions; you never issue a final verdict.

COMMUNICATION STYLE:
- Warm, direct, neighborly. No-nonsense. Like a neighbor who has lived on the block forever and tells it straight.
- Keep responses short: 2-4 sentences.
- Use numbered lists only for genuine step-by-steps, max 3-4 items.
- No markdown tables. Sound like you're texting back.
- If the user writes in another language, respond in that language.

TROUBLESHOOT FIRST:
Acknowledge briefly, ask one clarifying question, then use tools on their data (get_user_activity, get_report_history, search_content, search_listings). Only offer a human ticket as a last resort: "If that doesn't sort it, I can get a real person involved."

TOOLS:
- search_content: Community posts/comments only.
- search_listings: live Jobs/Gigs/Marketplace/Housing.
- get_user_activity: their listings/orders/bids.
- get_report_history: their reports/tickets/disputes.
- create_report: community post/comment, confirm first.
- create_support_ticket: non-content human queue, confirm first, last resort.
Never claim you looked something up unless you called the tool. If a tool returns not_found or empty, say you couldn't find anything on their account — do not invent records.

KEY RULES:
Must be 18+. PhillyGrind does not employ, own listings, or guarantee outcomes. No harassment, doxxing, spam, illegal content. Jobs/gigs: no discriminatory hiring, MLM, or unpaid labor. Marketplace: no weapons/drugs/stolen goods; Secure Checkout is 8% with escrow. Housing must follow Fair Housing / Philly source-of-income rules. You never decide violations; humans review reports. Emails stay private. Support: support@phillygrind.work.`,
};

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

    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const safeMessages = messages
      .filter((message) => ['user', 'assistant'].includes(message.role))
      .map((message) => ({
        role: message.role,
        content: String(message.content || '').slice(0, 3200),
        meta: message.meta || null,
        kind: message.kind || null,
      }))
      .filter((message) => message.content.trim() || message.meta?.awaitingTicketConfirm || message.kind === 'ticket_offer')
      .slice(-12);

    if (!safeMessages.length) {
      sendJson(res, 400, { error: 'A message is required.' });
      return;
    }

    const clientHint = req.body?.clientHint || null;
    const lastUserText = safeMessages[safeMessages.length - 1]?.content || '';
    const bypassDebug = debugTicketConfirmGates(safeMessages, clientHint);

    if (isAwaitingTicketConfirm(safeMessages, clientHint)) {
      const decision = classifyConfirmation(lastUserText);

      if (decision === 'no') {
        sendJson(res, 200, {
          reply: TICKET_DECLINED_REPLY,
          meta: { ticketConfirmDeclined: true },
        });
        return;
      }

      if (decision === 'yes') {
        if (!passesTicketConfirmSafetyGates(safeMessages)) {
          console.log('[GrindBot] Ticket confirm blocked by safety gates', bypassDebug);
          sendJson(res, 200, {
            reply: TICKET_BLOCKED_REPLY,
            meta: { ticketConfirmBlocked: true },
          });
          return;
        }

        const draft = clientHint?.ticketDraft || buildTicketDraft(safeMessages.slice(0, -1));
        console.log('[GrindBot] Ticket confirm bypass — calling createSupportTicket', {
          userId: user.id,
          draft,
        });
        try {
          const result = await createSupportTicket(draft, user.id);
          console.log('[GrindBot] Ticket filed via confirm bypass', result.ticket?.id);
          sendJson(res, 200, {
            reply: TICKET_FILED_REPLY,
            meta: { ticketFiled: true, ticket: result.ticket },
          });
          return;
        } catch (error) {
          console.error('[GrindBot] Ticket confirm insert failed', error.message);
          sendJson(res, 500, { error: error.message || 'Could not submit your ticket.' });
          return;
        }
      }

      console.log('[GrindBot] Ticket confirm awaiting but ambiguous user reply — falling through to Groq', bypassDebug);
    }

    console.log('[GrindBot] Pre-Groq bypass check (no bypass taken)', bypassDebug);

    if (!process.env.GROQ_API_KEY) {
      console.error('[GrindBot] GROQ_API_KEY missing — returning fallback (check .env / .env.local and restart dev:full)');
      sendJson(res, 500, { error: USER_DOWN_MESSAGE });
      return;
    }

    const persona = PERSONAS[req.body?.persona] ? req.body.persona : 'hustle';
    const groqMessages = safeMessages.map(({ role, content }) => ({ role, content }));
    let currentMessages = [
      { role: 'system', content: PERSONAS[persona] },
      ...groqMessages,
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
          message: payload?.error?.message,
          code: payload?.error?.code,
          type: payload?.error?.type,
          remainingTokens: response.headers.get('x-ratelimit-remaining-tokens'),
          limitTokens: response.headers.get('x-ratelimit-limit-tokens'),
          remainingRequests: response.headers.get('x-ratelimit-remaining-requests'),
          resetTokens: response.headers.get('x-ratelimit-reset-tokens'),
          retryAfter: response.headers.get('retry-after'),
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

    sendJson(res, 200, {
      reply,
      meta: buildTicketConfirmMeta(safeMessages, reply) || undefined,
    });
  } catch (error) {
    const status = error.status === 429 ? 429 : 500;
    sendJson(res, status, { error: publicGrindBotError(error, error.status) });
  }
}
