import { supabaseAdmin } from '../_utils.js';

export const ACTIVITY_LIMIT = 8;
export const HISTORY_LIMIT = 12;

function clip(value, max = 220) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

function dollars(cents) {
  const value = Number(cents);
  if (!Number.isFinite(value)) return null;
  return `$${(value / 100).toFixed(2)}`;
}

export async function getUserActivity(userId) {
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
    supabaseAdmin.from('jobs').select('id,title,category,neighborhood,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabaseAdmin.from('gigs').select('id,title,category,neighborhood,status,post_type,pay,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabaseAdmin.from('marketplace_listings').select('id,title,category,neighborhood,status,price,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabaseAdmin.from('housing_listings').select('id,title,neighborhood,status,monthly_rent,bedrooms,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabaseAdmin.from('bids').select('id,listing_id,status,proposed_rate,created_at').eq('worker_id', userId).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabaseAdmin.from('applications').select('id,job_id,status,created_at').eq('applicant_id', userId).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabaseAdmin.from('orders').select('id,listing_id,status,amount,created_at,hirer_id,worker_id').eq('hirer_id', userId).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabaseAdmin.from('orders').select('id,listing_id,status,amount,created_at,hirer_id,worker_id').eq('worker_id', userId).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabaseAdmin.from('marketplace_orders').select('id,listing_id,status,amount,created_at,buyer_id,seller_id').eq('buyer_id', userId).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabaseAdmin.from('marketplace_orders').select('id,listing_id,status,amount,created_at,buyer_id,seller_id').eq('seller_id', userId).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
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
      role: order.hirer_id === userId ? 'hirer' : 'worker',
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
      role: order.buyer_id === userId ? 'buyer' : 'seller',
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

export async function getReportsAgainstUser(userId) {
  const [
    userReports,
    jobs,
    gigs,
    marketplace,
    posts,
    comments,
  ] = await Promise.all([
    supabaseAdmin
      .from('reports')
      .select('id,reported_type,reported_id,listing_type,reason,status,created_at,reporter_id')
      .eq('reported_type', 'user')
      .eq('reported_id', userId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT),
    supabaseAdmin.from('jobs').select('id').eq('user_id', userId),
    supabaseAdmin.from('gigs').select('id').eq('user_id', userId),
    supabaseAdmin.from('marketplace_listings').select('id').eq('user_id', userId),
    supabaseAdmin.from('community_posts').select('id').eq('user_id', userId),
    supabaseAdmin.from('community_comments').select('id').eq('user_id', userId),
  ]);

  const listingIds = [
    ...(jobs.data || []).map((row) => row.id),
    ...(gigs.data || []).map((row) => row.id),
    ...(marketplace.data || []).map((row) => row.id),
  ];

  let listingReports = [];
  if (listingIds.length) {
    const { data } = await supabaseAdmin
      .from('reports')
      .select('id,reported_type,reported_id,listing_type,reason,status,created_at,reporter_id')
      .eq('reported_type', 'listing')
      .in('reported_id', listingIds)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT);
    listingReports = data || [];
  }

  const postIds = (posts.data || []).map((row) => row.id);
  const commentIds = (comments.data || []).map((row) => row.id);

  let communityAgainst = [];
  if (postIds.length) {
    const { data } = await supabaseAdmin
      .from('community_reports')
      .select('id,post_id,comment_id,reason,subreason,status,created_at,reporter_id')
      .in('post_id', postIds)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT);
    communityAgainst = [...communityAgainst, ...(data || [])];
  }
  if (commentIds.length) {
    const { data } = await supabaseAdmin
      .from('community_reports')
      .select('id,post_id,comment_id,reason,subreason,status,created_at,reporter_id')
      .in('comment_id', commentIds)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT);
    communityAgainst = [...communityAgainst, ...(data || [])];
  }

  return {
    user_reports: userReports.data || [],
    listing_reports: listingReports,
    community_reports_against: communityAgainst,
  };
}

export async function getReportHistory(userId) {
  const [community, listingReports, tickets, ownMarketOrders] = await Promise.all([
    supabaseAdmin
      .from('community_reports')
      .select('id,post_id,comment_id,reason,subreason,status,created_at')
      .eq('reporter_id', userId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT),
    supabaseAdmin
      .from('reports')
      .select('id,reported_type,reported_id,listing_type,reason,status,created_at')
      .eq('reporter_id', userId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT),
    supabaseAdmin
      .from('contact_submissions')
      .select('id,category,status,created_at,message')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT),
    supabaseAdmin
      .from('marketplace_orders')
      .select('id')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`),
  ]);

  let disputes = [];
  const orderIds = (ownMarketOrders.data || []).map((row) => row.id);
  if (orderIds.length) {
    const { data } = await supabaseAdmin
      .from('disputes')
      .select('id,order_id,status,created_at,seller_evidence_deadline')
      .in('order_id', orderIds)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT);
    disputes = data || [];
  }

  return {
    community_reports_filed: community.data || [],
    listing_reports_filed: listingReports.data || [],
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

export async function buildUserHistoryTimeline(userId) {
  const [filed, against] = await Promise.all([
    getReportHistory(userId),
    getReportsAgainstUser(userId),
  ]);

  const items = [];

  for (const row of filed.community_reports_filed) {
    items.push({
      id: `community-filed-${row.id}`,
      kind: 'community_report_filed',
      label: 'Community report filed',
      detail: row.subreason ? `${row.reason}: ${row.subreason}` : row.reason,
      status: row.status,
      created_at: row.created_at,
    });
  }

  for (const row of filed.listing_reports_filed) {
    items.push({
      id: `report-filed-${row.id}`,
      kind: 'report_filed',
      label: `Report filed (${row.reported_type})`,
      detail: row.reason,
      status: row.status,
      created_at: row.created_at,
    });
  }

  for (const row of filed.support_tickets) {
    items.push({
      id: `ticket-${row.id}`,
      kind: 'support_ticket',
      label: `Support ticket (${row.category})`,
      detail: row.message,
      status: row.status,
      created_at: row.created_at,
    });
  }

  for (const row of filed.disputes) {
    items.push({
      id: `dispute-${row.id}`,
      kind: 'dispute',
      label: 'Marketplace dispute',
      detail: `Order ${row.order_id}`,
      status: row.status,
      created_at: row.created_at,
    });
  }

  for (const row of against.user_reports) {
    items.push({
      id: `against-user-${row.id}`,
      kind: 'report_against',
      label: 'User report received',
      detail: row.reason,
      status: row.status,
      created_at: row.created_at,
    });
  }

  for (const row of against.listing_reports) {
    items.push({
      id: `against-listing-${row.id}`,
      kind: 'report_against',
      label: `Listing report (${row.listing_type || 'listing'})`,
      detail: row.reason,
      status: row.status,
      created_at: row.created_at,
    });
  }

  for (const row of against.community_reports_against) {
    items.push({
      id: `against-community-${row.id}`,
      kind: 'report_against',
      label: 'Community content reported',
      detail: row.subreason ? `${row.reason}: ${row.subreason}` : row.reason,
      status: row.status,
      created_at: row.created_at,
    });
  }

  items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return items.slice(0, HISTORY_LIMIT * 2);
}

const POLICY_EXCERPTS = {
  harassment: {
    title: 'Harassment & abuse',
    bullets: [
      'PhillyGrind prohibits targeted harassment, threats, and discriminatory language in listings and community content.',
      'Warn for first-time or borderline cases; remove content and consider suspension for repeat or severe violations.',
      'Document the specific language or behavior in your resolution notes.',
    ],
  },
  spam: {
    title: 'Spam & misleading listings',
    bullets: [
      'Listings must accurately describe real work or items available in the Philadelphia area.',
      'Duplicate, misleading, or off-platform solicitation posts may be removed.',
      'Check whether the poster has similar flagged listings in activity history.',
    ],
  },
  inappropriate: {
    title: 'Inappropriate content',
    bullets: [
      'Content must comply with community standards and applicable law.',
      'Remove content that is sexually explicit, violent, or otherwise unsuitable for a local jobs marketplace.',
    ],
  },
  scam: {
    title: 'Fraud & scams',
    bullets: [
      'Watch for payment-off-platform pressure, unrealistic pay, or identity theft patterns.',
      'Remove listings and consider user-level action when fraud is likely.',
      'Escrow disputes follow separate marketplace handoff rules (Terms §6).',
    ],
  },
  user: {
    title: 'User conduct reports',
    bullets: [
      'Review the reported user\'s history for prior warnings or removals.',
      'User warnings send an in-app notification; removals may include deleting associated listings.',
      'PhillyGrind is a platform — final employment or transaction outcomes remain between users.',
    ],
  },
  listing: {
    title: 'Listing moderation',
    bullets: [
      'Verify the listing matches its category and Philadelphia location.',
      'Ban-the-Box: job listings must not include criminal history screening language (Terms §4).',
      'Remove deletes the listing; warn notifies the poster via notification when applicable.',
    ],
  },
  community: {
    title: 'Community guidelines',
    bullets: [
      'Community posts and comments must stay relevant, respectful, and local.',
      'Removing a post or comment deletes the reported content; consider whether the author has a pattern of violations.',
    ],
  },
  recovery: {
    title: 'Account recovery review',
    bullets: [
      'Compare submitted answers against the frozen snapshot captured at submission time.',
      'Use live refresh only to see current account state — the frozen snapshot is the source of truth for approval.',
      'Approve sends a one-time reset link to the new email only; deny if answers do not match or seem fraudulent.',
    ],
  },
  contact: {
    title: 'Support & contact requests',
    bullets: [
      'Reply from admin updates status to responded; resolve when the issue is closed.',
      'Data deletion and fair housing complaints may require extra documentation — see Terms and Privacy Policy.',
      'Logged-in submitters can be cross-checked against their account snapshot and history.',
    ],
  },
  contact_fair_housing: {
    title: 'Fair housing complaint',
    bullets: [
      'PhillyGrind prohibits discriminatory housing listings and conduct (Terms §5, Fair Housing Act).',
      'Document the listing or user involved and escalate patterns to listing removal or account action.',
    ],
  },
  contact_data_deletion: {
    title: 'Data deletion request',
    bullets: [
      'Verify identity before deleting personal data (Privacy Policy §4).',
      'Some transaction records may be retained where required by law or Stripe reconciliation.',
    ],
  },
  dispute: {
    title: 'Marketplace escrow disputes',
    bullets: [
      'Review buyer and seller evidence, tamper scores, and EXIF metadata before deciding.',
      'Release to seller when handoff was valid; refund buyer when item was not as described or not delivered.',
      'Funds remain in escrow until you resolve — auto-release rules do not apply to open disputes.',
    ],
  },
  default: {
    title: 'General moderation',
    bullets: [
      'Human review is required — GrindBot and auto-moderation scores are advisory only.',
      'Dismiss if the report is invalid or insufficient; warn for minor issues; remove for clear violations.',
      'See Terms of Service §9 (User Content) and §10 (Account Suspension) for policy context.',
    ],
  },
};

function normalizeReasonKey(reason) {
  return String(reason || '').toLowerCase();
}

export function getPolicyContext(caseType, reason, subreason) {
  const combined = `${normalizeReasonKey(reason)} ${normalizeReasonKey(subreason)}`;

  if (caseType === 'community_report') {
    if (combined.includes('harass')) return POLICY_EXCERPTS.harassment;
    if (combined.includes('spam')) return POLICY_EXCERPTS.spam;
    return POLICY_EXCERPTS.community;
  }

  if (caseType === 'user_report') {
    if (combined.includes('harass')) return POLICY_EXCERPTS.harassment;
    if (combined.includes('scam') || combined.includes('fraud')) return POLICY_EXCERPTS.scam;
    return POLICY_EXCERPTS.user;
  }

  if (caseType === 'listing_report') {
    if (combined.includes('spam')) return POLICY_EXCERPTS.spam;
    if (combined.includes('scam') || combined.includes('fraud')) return POLICY_EXCERPTS.scam;
    if (combined.includes('inappropriate')) return POLICY_EXCERPTS.inappropriate;
    return POLICY_EXCERPTS.listing;
  }

  if (caseType === 'recovery') return POLICY_EXCERPTS.recovery;

  if (caseType === 'contact') {
    const cat = normalizeReasonKey(reason);
    if (cat.includes('fair_housing')) return POLICY_EXCERPTS.contact_fair_housing;
    if (cat.includes('data_deletion')) return POLICY_EXCERPTS.contact_data_deletion;
    return POLICY_EXCERPTS.contact;
  }

  if (caseType === 'dispute') return POLICY_EXCERPTS.dispute;

  return POLICY_EXCERPTS.default;
}

export function caseTypeLabel(caseType) {
  switch (caseType) {
    case 'listing_report':
      return 'Listing report';
    case 'user_report':
      return 'User report';
    case 'community_report':
      return 'Community report';
    case 'recovery':
      return 'Account recovery';
    case 'contact':
      return 'Contact submission';
    case 'dispute':
      return 'Marketplace dispute';
    default:
      return caseType;
  }
}
