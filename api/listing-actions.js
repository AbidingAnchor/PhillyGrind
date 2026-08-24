import {
  getUserFromRequest,
  hasServerSupabaseConfig,
  isCronAuthorized,
  requireAdmin,
  requireMethod,
  sendJson,
  supabaseAdmin,
} from './_utils.js';
import {
  buildModerationText,
  moderateText,
  MODERATION_REJECT_MESSAGE,
} from './_utils/moderation.js';
import { createRateLimiter, checkRateLimit } from './_utils/rateLimit.js';
import { handleWeatherAlerts } from './_weatherAlerts.js';
import { handleDispatchWeatherAlertNotifications } from './_weatherAlertNotifications.js';

const limiter = createRateLimiter(30, '60 s');

const tableFor = (type) => {
  if (type === 'gig') return 'gigs';
  if (type === 'marketplace') return 'marketplace_listings';
  if (type === 'community') return 'community_posts';
  return 'jobs';
};

async function createModerationReport({
  reportedType,
  reportedId,
  listingType,
  reason,
  scores,
}) {
  const { error } = await supabaseAdmin.from('reports').insert({
    reporter_id: null,
    reported_type: reportedType,
    reported_id: reportedId,
    listing_type: listingType || null,
    reason,
    status: 'pending',
    source: 'moderation',
    moderation_scores: scores,
  });

  if (error) throw error;
}

async function handleCreateListing(req, res, user) {
  const { listing_type: listingType, listing, boost_tier: boostTier } = req.body ?? {};

  if (!['job', 'gig', 'marketplace', 'community'].includes(listingType)) {
    sendJson(res, 400, { error: 'A valid listing type is required.' });
    return;
  }

  const textFields = listingType === 'marketplace'
    ? { title: listing.title, description: listing.description, location: listing.location }
    : listingType === 'community'
    ? { content: listing.content, neighborhood: listing.neighborhood }
    : {
      title: listing.title,
      description: listing.description,
      company: listing.company,
      neighborhood: listing.neighborhood,
      pay: listing.pay,
    };

  const moderation = await moderateText(buildModerationText(textFields));

  if (moderation.action === 'reject') {
    sendJson(res, 422, { error: MODERATION_REJECT_MESSAGE });
    return;
  }

  const moderationStatus = moderation.action === 'flag' ? 'flagged' : 'approved';

  if (listingType === 'marketplace') {
    const payload = {
      title: listing.title.trim(),
      description: listing.description.trim(),
      price: parseFloat(listing.price) || 0,
      category: listing.category,
      condition: listing.condition,
      location: listing.location.trim(),
      payment_type: listing.payment_type || 'both',
      status: 'active',
      photos: [],
      moderation_status: moderationStatus,
      user_id: user.id,
    };

    const { data, error } = await supabaseAdmin
      .from('marketplace_listings')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    if (moderation.action === 'flag') {
      await createModerationReport({
        reportedType: 'listing',
        reportedId: data.id,
        listingType: 'marketplace',
        reason: `Auto-flagged for review (${moderation.flaggedCategories.join(', ')})`,
        scores: moderation.scores,
      });
    }

    sendJson(res, 200, { listing: { ...data, type: 'marketplace' }, moderationStatus });
    return;
  }

  if (listingType === 'community') {
    // Check if user is suspended before allowing post creation
    const { data: suspension, error: suspensionError } = await supabaseAdmin
      .from('suspended_users')
      .select('*')
      .eq('user_id', user.id)
      .is('lifted_at', null)
      .or('expires_at.is.null,expires_at.gt.now()')
      .maybeSingle();

    if (suspension) {
      sendJson(res, 403, { error: 'Your account is suspended and cannot create posts at this time.' });
      return;
    }

    const payload = {
      content: listing.content.trim(),
      neighborhood: listing.neighborhood,
      photo_url: null,
      like_count: 0,
      user_id: user.id,
      group_id: listing.group_id || null,
    };

    const { data, error } = await supabaseAdmin
      .from('community_posts')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    if (moderation.action === 'flag') {
      await createModerationReport({
        reportedType: 'listing',
        reportedId: data.id,
        listingType: 'community',
        reason: `Auto-flagged for review (${moderation.flaggedCategories.join(', ')})`,
        scores: moderation.scores,
      });
    }

    sendJson(res, 200, { listing: { ...data, type: 'community' }, moderationStatus });
    return;
  }

  const payload = { ...listing };
  if (listingType === 'job') {
    payload.apply_url = payload.apply_url?.trim() || null;
  } else {
    delete payload.apply_url;
  }

  // Check if user is suspended before allowing listing creation
  const { data: suspension, error: suspensionError } = await supabaseAdmin
    .from('suspended_users')
    .select('*')
    .eq('user_id', user.id)
    .is('lifted_at', null)
    .or('expires_at.is.null,expires_at.gt.now()')
    .maybeSingle();

  if (suspension) {
    sendJson(res, 403, { error: 'Your account is suspended and cannot create listings at this time.' });
    return;
  }

  const boostFields = ['basic', 'pro'].includes(boostTier)
    ? {
      is_boosted: false,
      boost_tier: boostTier,
      boost_expires_at: null,
      boost_pending: true,
    }
    : {};

  const { data, error } = await supabaseAdmin
    .from(tableFor(listingType))
    .insert({
      ...payload,
      ...boostFields,
      moderation_status: moderationStatus,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  if (moderation.action === 'flag') {
    await createModerationReport({
      reportedType: 'listing',
      reportedId: data.id,
      listingType,
      reason: `Auto-flagged for review (${moderation.flaggedCategories.join(', ')})`,
      scores: moderation.scores,
    });
  }

  sendJson(res, 200, { listing: { ...data, type: listingType }, moderationStatus });
}

async function handleAdminDeleteListing(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { listing_id: listingId, listing_type: listingType } = req.body ?? {};
  if (!listingId || !['job', 'gig', 'marketplace'].includes(listingType)) {
    sendJson(res, 400, { error: 'Valid listing id and type are required.' });
    return;
  }

  const table = tableFor(listingType);

  if (listingType === 'marketplace') {
    const { error } = await supabaseAdmin
      .from(table)
      .update({ status: 'removed', moderation_status: 'removed' })
      .eq('id', listingId);

    if (error) throw error;
    sendJson(res, 200, { ok: true });
    return;
  }

  const { error } = await supabaseAdmin.from(table).delete().eq('id', listingId);
  if (error) throw error;
  sendJson(res, 200, { ok: true });
}

async function handleUnavailableListings(req, res) {
  const listingIds = [...new Set((req.body?.listing_ids ?? []).filter(Boolean))];
  if (!listingIds.length) {
    sendJson(res, 200, { unavailableListingIds: [] });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('listing_id')
    .in('listing_id', listingIds)
    .neq('status', 'cancelled');

  if (error) throw error;

  sendJson(res, 200, {
    unavailableListingIds: [...new Set((data ?? []).map((order) => order.listing_id))],
  });
}

async function handleUserDeleteListing(req, res, user) {
  const { listing_id: listingId, listing_type: listingType } = req.body ?? {};
  if (!listingId || !['job', 'gig'].includes(listingType)) {
    sendJson(res, 400, { error: 'A valid listing id and listing type are required.' });
    return;
  }

  const table = tableFor(listingType);
  const { data: listing, error: listingError } = await supabaseAdmin
    .from(table)
    .select('id,user_id')
    .eq('id', listingId)
    .maybeSingle();

  if (listingError) throw listingError;

  if (!listing) {
    sendJson(res, 404, { error: 'Listing not found.' });
    return;
  }

  if (listing.user_id !== user.id) {
    sendJson(res, 403, { error: 'Only the original poster can delete this listing.' });
    return;
  }

  const { data: blockingOrders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('id,status')
    .eq('listing_id', listingId)
    .neq('status', 'cancelled')
    .limit(1);

  if (ordersError) throw ordersError;

  if (blockingOrders?.length) {
    sendJson(res, 409, {
      error: 'This listing cannot be deleted because it has an active or completed order.',
    });
    return;
  }

  const { error: deleteError } = await supabaseAdmin
    .from(table)
    .delete()
    .eq('id', listingId)
    .eq('user_id', user.id);

  if (deleteError) throw deleteError;

  sendJson(res, 200, { ok: true });
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    sendJson(res, 405, { error: `Method ${req.method} not allowed.` });
    return;
  }

  const action = req.query.action;

  if (action === 'dispatch-weather-alert-notifications') {
    if (req.method !== 'GET' && req.method !== 'POST') {
      sendJson(res, 405, { error: `Method ${req.method} not allowed.` });
      return;
    }
    if (!isCronAuthorized(req)) {
      sendJson(res, 401, { error: 'Unauthorized.' });
      return;
    }
    if (!hasServerSupabaseConfig) {
      sendJson(res, 500, { error: 'Server Supabase configuration is missing.' });
      return;
    }
    await handleDispatchWeatherAlertNotifications(req, res);
    return;
  }

  const identifier = req.headers['x-forwarded-for'] || 'anonymous';
  if (!(await checkRateLimit(limiter, identifier, res))) return;

  if (action === 'weather-alerts') {
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: `Method ${req.method} not allowed.` });
      return;
    }
    await handleWeatherAlerts(req, res);
    return;
  }

  if (!hasServerSupabaseConfig) {
    sendJson(res, 500, { error: 'Server Supabase configuration is missing.' });
    return;
  }

  // Update bid status
  if (action === 'update-bid-status') {
    try {
      const user = await getUserFromRequest(req);
      if (!user) {
        sendJson(res, 401, { error: 'Authentication required.' });
        return;
      }

      const { bid_id: bidId, status } = req.body ?? {};
      if (!bidId || !['accepted', 'rejected'].includes(status)) {
        sendJson(res, 400, { error: 'A valid bid id and status are required.' });
        return;
      }

      const { data: bid, error: bidError } = await supabaseAdmin
        .from('bids')
        .select('id,listing_id,worker_id,pitch,status,created_at')
        .eq('id', bidId)
        .maybeSingle();

      if (bidError) throw bidError;
      if (!bid) {
        sendJson(res, 404, { error: 'Bid not found.' });
        return;
      }

      const { data: gig, error: gigError } = await supabaseAdmin
        .from('gigs')
        .select('id,user_id,status')
        .eq('id', bid.listing_id)
        .maybeSingle();

      if (gigError) throw gigError;
      if (!gig) {
        sendJson(res, 404, { error: 'Gig not found.' });
        return;
      }

      if (gig.user_id !== user.id) {
        sendJson(res, 403, { error: 'Only the gig poster can manage bids.' });
        return;
      }

      if (status === 'accepted') {
        const { error: rejectOthersError } = await supabaseAdmin
          .from('bids')
          .update({ status: 'rejected' })
          .eq('listing_id', bid.listing_id)
          .neq('id', bid.id);

        if (rejectOthersError) throw rejectOthersError;

        const { error: acceptError } = await supabaseAdmin
          .from('bids')
          .update({ status: 'accepted' })
          .eq('id', bid.id);

        if (acceptError) throw acceptError;

        const { error: gigUpdateError } = await supabaseAdmin
          .from('gigs')
          .update({ status: 'in progress' })
          .eq('id', bid.listing_id);

        if (gigUpdateError) throw gigUpdateError;
      } else {
        const { error: rejectError } = await supabaseAdmin
          .from('bids')
          .update({ status: 'rejected' })
          .eq('id', bid.id);

        if (rejectError) throw rejectError;
      }

      const { data: bids, error: bidsError } = await supabaseAdmin
        .from('bids')
        .select('id,listing_id,worker_id,pitch,status,created_at')
        .eq('listing_id', bid.listing_id)
        .order('created_at', { ascending: false });

      if (bidsError) throw bidsError;

      sendJson(res, 200, { bid: { ...bid, status }, bids: bids ?? [] });
    } catch (error) {
      sendJson(res, 500, { error: error.message || 'Could not update bid.' });
    }
    return;
  }

  // Create listing
  if (action === 'create-listing') {
    const user = await getUserFromRequest(req);
    if (!user) {
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }
    await handleCreateListing(req, res, user);
    return;
  }

  // Admin delete listing
  if (action === 'admin-delete-listing') {
    await handleAdminDeleteListing(req, res);
    return;
  }

  // Unavailable listings
  if (action === 'unavailable-listings') {
    await handleUnavailableListings(req, res);
    return;
  }

  // User delete listing
  if (action === 'delete-listing') {
    const user = await getUserFromRequest(req);
    if (!user) {
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }
    await handleUserDeleteListing(req, res, user);
    return;
  }

  sendJson(res, 400, { error: 'A valid action is required.' });
}
