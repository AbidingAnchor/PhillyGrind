import {
  getUserFromRequest,
  handleProfileStatsRequest,
  hasServerSupabaseConfig,
  requireAdmin,
  requireMethod,
  sendJson,
  stripe,
  supabaseAdmin,
} from './_utils.js';

async function releasePayment(req, res) {
  const user = await getUserFromRequest(req);
  const isAutoRelease = req.headers['x-phillygrind-auto-release'] === process.env.AUTO_RELEASE_SECRET;

  if (!user && !isAutoRelease) {
    sendJson(res, 401, { error: 'Authentication required.' });
    return;
  }

  const { order_id: orderId } = req.body ?? {};
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id,hirer_id,worker_id,status,stripe_payment_intent_id')
    .eq('id', orderId)
    .single();

  if (orderError) throw orderError;

  if (order.hirer_id !== user?.id && !isAutoRelease) {
    sendJson(res, 403, { error: 'Only the hirer can release payment.' });
    return;
  }

  if (!['pending', 'escrowed', 'completed'].includes(order.status)) {
    sendJson(res, 400, { error: `Cannot release an order with status ${order.status}.` });
    return;
  }

  const paymentIntent = await stripe.paymentIntents.capture(order.stripe_payment_intent_id);
  const { data: updatedOrder, error: updateError } = await supabaseAdmin
    .from('orders')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      released_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .select('*')
    .single();

  if (updateError) throw updateError;

  sendJson(res, 200, { order: updatedOrder, paymentIntent });
}

async function expireTable(table) {
  const { error } = await supabaseAdmin
    .from(table)
    .update({
      is_boosted: false,
      boost_tier: null,
      boost_expires_at: null,
    })
    .eq('is_boosted', true)
    .lt('boost_expires_at', new Date().toISOString());

  if (error) throw error;
}

async function expireBoosts(req, res) {
  await Promise.all([
    expireTable('jobs'),
    expireTable('gigs'),
  ]);

  sendJson(res, 200, { expired: true });
}

async function handleAdminOverview(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const [
    usersResult,
    jobsResult,
    gigsResult,
    marketplaceResult,
    applicationsResult,
    disputesResult,
    reportsResult,
    recentJobs,
    recentGigs,
    recentMarketplace,
    recentApplications,
    recentDisputes,
    recentReports,
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('gigs').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('marketplace_listings').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('applications').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabaseAdmin.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('jobs').select('id,title,created_at,user_id').order('created_at', { ascending: false }).limit(5),
    supabaseAdmin.from('gigs').select('id,title,created_at,user_id').order('created_at', { ascending: false }).limit(5),
    supabaseAdmin.from('marketplace_listings').select('id,title,created_at,user_id').order('created_at', { ascending: false }).limit(5),
    supabaseAdmin.from('applications').select('id,job_id,applicant_id,created_at,status').order('created_at', { ascending: false }).limit(5),
    supabaseAdmin.from('disputes').select('id,order_id,status,created_at').order('created_at', { ascending: false }).limit(5),
    supabaseAdmin.from('reports').select('id,reported_type,reported_id,reason,status,created_at,source').order('created_at', { ascending: false }).limit(5),
  ]);

  const errors = [
    usersResult.error,
    jobsResult.error,
    gigsResult.error,
    marketplaceResult.error,
    applicationsResult.error,
    disputesResult.error,
    reportsResult.error,
  ].filter(Boolean);

  if (errors.length) throw errors[0];

  const activity = [
    ...(recentJobs.data ?? []).map((item) => ({
      type: 'job',
      id: item.id,
      title: item.title,
      created_at: item.created_at,
    })),
    ...(recentGigs.data ?? []).map((item) => ({
      type: 'gig',
      id: item.id,
      title: item.title,
      created_at: item.created_at,
    })),
    ...(recentMarketplace.data ?? []).map((item) => ({
      type: 'marketplace',
      id: item.id,
      title: item.title,
      created_at: item.created_at,
    })),
    ...(recentApplications.data ?? []).map((item) => ({
      type: 'application',
      id: item.id,
      title: `Application for job ${item.job_id?.slice(0, 8)}…`,
      created_at: item.created_at,
      status: item.status,
    })),
    ...(recentDisputes.data ?? []).map((item) => ({
      type: 'dispute',
      id: item.id,
      title: `Dispute on order ${item.order_id?.slice(0, 8)}…`,
      created_at: item.created_at,
      status: item.status,
    })),
    ...(recentReports.data ?? []).map((item) => ({
      type: 'report',
      id: item.id,
      title: item.reason,
      created_at: item.created_at,
      status: item.status,
      source: item.source,
    })),
  ]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 15);

  sendJson(res, 200, {
    stats: {
      totalUsers: usersResult.count ?? 0,
      totalJobs: jobsResult.count ?? 0,
      totalGigs: gigsResult.count ?? 0,
      totalMarketplace: marketplaceResult.count ?? 0,
      totalApplications: applicationsResult.count ?? 0,
      openDisputes: disputesResult.count ?? 0,
      pendingReports: reportsResult.count ?? 0,
    },
    activity,
  });
}

async function handleAdminUsers(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id,name,email,created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const userIds = (profiles ?? []).map((profile) => profile.id);
  const [jobsResult, gigsResult, marketplaceResult, suspensionsResult] = await Promise.all([
    supabaseAdmin.from('jobs').select('user_id').in('user_id', userIds),
    supabaseAdmin.from('gigs').select('user_id').in('user_id', userIds),
    supabaseAdmin.from('marketplace_listings').select('user_id').in('user_id', userIds),
    supabaseAdmin.from('suspended_users').select('*').in('user_id', userIds).is('lifted_at', null),
  ]);

  if (jobsResult.error) throw jobsResult.error;
  if (gigsResult.error) throw gigsResult.error;
  if (marketplaceResult.error) throw marketplaceResult.error;
  if (suspensionsResult.error) throw suspensionsResult.error;

  const listingCounts = {};
  for (const row of [...(jobsResult.data ?? []), ...(gigsResult.data ?? []), ...(marketplaceResult.data ?? [])]) {
    listingCounts[row.user_id] = (listingCounts[row.user_id] || 0) + 1;
  }

  const suspensionByUser = Object.fromEntries(
    (suspensionsResult.data ?? []).map((row) => [row.user_id, row]),
  );

  sendJson(res, 200, {
    users: (profiles ?? []).map((profile) => ({
      ...profile,
      listingCount: listingCounts[profile.id] || 0,
      suspension: suspensionByUser[profile.id] || null,
    })),
  });
}

async function handleAdminListings(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const typeFilter = req.query.type || 'all';
  const statusFilter = req.query.status || 'all';

  const queries = [];
  if (typeFilter === 'all' || typeFilter === 'job') {
    queries.push(
      supabaseAdmin
        .from('jobs')
        .select('id,title,category,created_at,user_id,moderation_status')
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).map((row) => ({ ...row, listing_type: 'job', status: row.moderation_status || 'approved' }));
        }),
    );
  }
  if (typeFilter === 'all' || typeFilter === 'gig') {
    queries.push(
      supabaseAdmin
        .from('gigs')
        .select('id,title,category,created_at,user_id,status,moderation_status')
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).map((row) => ({
            ...row,
            listing_type: 'gig',
            status: row.moderation_status || 'approved',
            gig_status: row.status,
          }));
        }),
    );
  }
  if (typeFilter === 'all' || typeFilter === 'marketplace') {
    queries.push(
      supabaseAdmin
        .from('marketplace_listings')
        .select('id,title,category,created_at,user_id,status,moderation_status')
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).map((row) => ({
            ...row,
            listing_type: 'marketplace',
            status: row.moderation_status || row.status || 'active',
          }));
        }),
    );
  }

  const listings = (await Promise.all(queries)).flat();
  const filtered = statusFilter === 'all'
    ? listings
    : listings.filter((listing) => listing.status === statusFilter);

  const userIds = [...new Set(filtered.map((listing) => listing.user_id).filter(Boolean))];
  const { data: profiles, error: profilesError } = userIds.length
    ? await supabaseAdmin.from('profiles').select('id,name,email').in('id', userIds)
    : { data: [], error: null };

  if (profilesError) throw profilesError;

  const profilesById = Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]));

  sendJson(res, 200, {
    listings: filtered
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map((listing) => ({
        ...listing,
        posterName: profilesById[listing.user_id]?.name || 'Unknown',
        posterEmail: profilesById[listing.user_id]?.email || '',
      })),
  });
}

async function handleAdminReports(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const status = req.query.status || 'pending';
  let query = supabaseAdmin
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data: reports, error } = await query;
  if (error) throw error;

  const reporterIds = [...new Set((reports ?? []).map((report) => report.reporter_id).filter(Boolean))];
  const { data: reporters } = reporterIds.length
    ? await supabaseAdmin.from('profiles').select('id,name,email').in('id', reporterIds)
    : { data: [] };

  const reportersById = Object.fromEntries((reporters ?? []).map((profile) => [profile.id, profile]));

  const enriched = await Promise.all((reports ?? []).map(async (report) => {
    let subjectTitle = '';
    if (report.reported_type === 'listing') {
      const table = report.listing_type === 'gig'
        ? 'gigs'
        : report.listing_type === 'marketplace'
          ? 'marketplace_listings'
          : 'jobs';
      const { data: listing } = await supabaseAdmin
        .from(table)
        .select('title')
        .eq('id', report.reported_id)
        .maybeSingle();
      subjectTitle = listing?.title || report.reported_id;
    } else {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('name,email')
        .eq('id', report.reported_id)
        .maybeSingle();
      subjectTitle = profile?.name || profile?.email || report.reported_id;
    }

    return {
      ...report,
      reporterName: report.reporter_id
        ? reportersById[report.reporter_id]?.name || 'User'
        : 'Auto-moderation',
      subjectTitle,
    };
  }));

  sendJson(res, 200, { reports: enriched });
}

async function handleAdminSuspendUser(req, res, admin) {
  const { user_id: userId, reason, action_type: actionType } = req.body ?? {};
  if (!userId || !reason?.trim()) {
    sendJson(res, 400, { error: 'User id and reason are required.' });
    return;
  }

  const type = actionType === 'banned' ? 'banned' : 'suspended';

  const { error: liftError } = await supabaseAdmin
    .from('suspended_users')
    .update({ lifted_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('lifted_at', null);

  if (liftError) throw liftError;

  const { data, error } = await supabaseAdmin
    .from('suspended_users')
    .upsert({
      user_id: userId,
      reason: reason.trim(),
      action_type: type,
      suspended_at: new Date().toISOString(),
      suspended_by: admin.id,
      lifted_at: null,
    }, { onConflict: 'user_id,action_type' })
    .select('*')
    .single();

  if (error) throw error;
  sendJson(res, 200, { suspension: data });
}

async function handleAdminLiftSuspension(req, res, admin) {
  const { user_id: userId } = req.body ?? {};
  if (!userId) {
    sendJson(res, 400, { error: 'User id is required.' });
    return;
  }

  const { error } = await supabaseAdmin
    .from('suspended_users')
    .update({ lifted_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('lifted_at', null);

  if (error) throw error;
  sendJson(res, 200, { ok: true });
}

async function handleAdminReportAction(req, res, admin) {
  const { report_id: reportId, action, warn_message: warnMessage } = req.body ?? {};
  if (!reportId || !['dismiss', 'warn', 'remove'].includes(action)) {
    sendJson(res, 400, { error: 'Valid report id and action are required.' });
    return;
  }

  const { data: report, error: fetchError } = await supabaseAdmin
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (fetchError) throw fetchError;

  const statusMap = { dismiss: 'dismissed', warn: 'warned', remove: 'removed' };
  const { error: updateError } = await supabaseAdmin
    .from('reports')
    .update({
      status: statusMap[action],
      resolved_at: new Date().toISOString(),
      resolved_by: admin.id,
    })
    .eq('id', reportId);

  if (updateError) throw updateError;

  if (action === 'remove' && report.reported_type === 'listing') {
    const table = report.listing_type === 'gig'
      ? 'gigs'
      : report.listing_type === 'marketplace'
        ? 'marketplace_listings'
        : 'jobs';

    if (report.listing_type === 'marketplace') {
      await supabaseAdmin
        .from(table)
        .update({ status: 'removed', moderation_status: 'removed' })
        .eq('id', report.reported_id);
    } else {
      await supabaseAdmin.from(table).delete().eq('id', report.reported_id);
    }
  }

  if (action === 'warn' && report.reported_type === 'user') {
    await supabaseAdmin.from('notifications').insert({
      user_id: report.reported_id,
      type: 'admin_warning',
      message: warnMessage?.trim() || report.reason,
    });
  }

  sendJson(res, 200, { ok: true });
}

const adminGetActions = new Set(['admin-overview', 'admin-users', 'admin-listings', 'admin-reports']);
const adminPostActions = new Set(['admin-suspend-user', 'admin-lift-suspension', 'admin-report-action']);

export default async function handler(req, res) {
  try {
    if (!hasServerSupabaseConfig && req.query.action?.startsWith('admin-')) {
      sendJson(res, 500, { error: 'Server Supabase configuration is missing.' });
      return;
    }

    if (req.method === 'GET' && req.query.action === 'profile-stats') {
      await handleProfileStatsRequest(req, res);
      return;
    }

    if (req.method === 'GET' && adminGetActions.has(req.query.action)) {
      switch (req.query.action) {
        case 'admin-overview':
          await handleAdminOverview(req, res);
          break;
        case 'admin-users':
          await handleAdminUsers(req, res);
          break;
        case 'admin-listings':
          await handleAdminListings(req, res);
          break;
        case 'admin-reports':
          await handleAdminReports(req, res);
          break;
        default:
          sendJson(res, 400, { error: 'Unknown admin action.' });
      }
      return;
    }

    if (req.method === 'POST' && adminPostActions.has(req.query.action)) {
      const admin = await requireAdmin(req, res);
      if (!admin) return;

      switch (req.query.action) {
        case 'admin-suspend-user':
          await handleAdminSuspendUser(req, res, admin);
          break;
        case 'admin-lift-suspension':
          await handleAdminLiftSuspension(req, res, admin);
          break;
        case 'admin-report-action':
          await handleAdminReportAction(req, res, admin);
          break;
        default:
          sendJson(res, 400, { error: 'Unknown admin action.' });
      }
      return;
    }

    if (!requireMethod(req, res)) return;

    if (req.query.action === 'release-payment' || req.query.action === 'release-funds') {
      await releasePayment(req, res);
      return;
    }

    if (req.query.action === 'expire-boosts') {
      await expireBoosts(req, res);
      return;
    }

    sendJson(res, 400, { error: 'Unknown orders action.' });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Orders request failed.' });
  }
}
