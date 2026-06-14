import {
  getUserFromRequest,
  hasServerSupabaseConfig,
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

const tableFor = (type) => {
  if (type === 'gig') return 'gigs';
  if (type === 'marketplace') return 'marketplace_listings';
  return 'jobs';
};

async function isUserSuspended(userId) {
  const { data, error } = await supabaseAdmin
    .from('suspended_users')
    .select('action_type')
    .eq('user_id', userId)
    .is('lifted_at', null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

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

  if (!['job', 'gig', 'marketplace'].includes(listingType)) {
    sendJson(res, 400, { error: 'A valid listing type is required.' });
    return;
  }

  const suspension = await isUserSuspended(user.id);
  if (suspension) {
    const label = suspension.action_type === 'banned' ? 'banned' : 'suspended';
    sendJson(res, 403, { error: `Your account is ${label} and cannot post listings.` });
    return;
  }

  const textFields = listingType === 'marketplace'
    ? { title: listing.title, description: listing.description, location: listing.location }
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

  const payload = { ...listing };
  if (listingType === 'job') {
    payload.apply_url = payload.apply_url?.trim() || null;
  } else {
    delete payload.apply_url;
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
  try {
    if (!hasServerSupabaseConfig) {
      sendJson(res, 500, { error: 'Server Supabase configuration is missing.' });
      return;
    }

    const action = req.query.action;

    if (req.method === 'POST' && action === 'unavailable-listings') {
      if (!requireMethod(req, res, 'POST')) return;
      await handleUnavailableListings(req, res);
      return;
    }

    if (req.method === 'POST' && action === 'create-listing') {
      if (!requireMethod(req, res, 'POST')) return;
      const user = await getUserFromRequest(req);
      if (!user) {
        sendJson(res, 401, { error: 'Authentication required.' });
        return;
      }
      await handleCreateListing(req, res, user);
      return;
    }

    if (req.method === 'POST' && action === 'admin-delete-listing') {
      if (!requireMethod(req, res, 'POST')) return;
      await handleAdminDeleteListing(req, res);
      return;
    }

    if (!requireMethod(req, res)) return;

    if (action === 'unavailable-listings') {
      await handleUnavailableListings(req, res);
      return;
    }

    const user = await getUserFromRequest(req);
    if (!user) {
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }

    if (action === 'admin-delete-listing') {
      await handleAdminDeleteListing(req, res);
      return;
    }

    await handleUserDeleteListing(req, res, user);
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Could not process listing request.' });
  }
}
