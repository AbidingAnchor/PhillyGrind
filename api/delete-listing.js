import { getUserFromRequest, requireMethod, sendJson, supabaseAdmin } from './_utils.js';

const tableFor = (type) => (type === 'gig' ? 'gigs' : 'jobs');

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

export default async function handler(req, res) {
  if (!requireMethod(req, res)) return;

  try {
    if (req.query.action === 'unavailable-listings') {
      await handleUnavailableListings(req, res);
      return;
    }

    const user = await getUserFromRequest(req);
    if (!user) {
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }

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
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Could not delete this listing.' });
  }
}
