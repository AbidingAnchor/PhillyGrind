import { requireMethod, sendJson, supabaseAdmin } from './_utils.js';

export default async function handler(req, res) {
  if (!requireMethod(req, res)) return;

  try {
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
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Could not check listing availability.' });
  }
}
