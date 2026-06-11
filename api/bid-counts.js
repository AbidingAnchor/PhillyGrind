import { requireMethod, sendJson, supabaseAdmin } from './_utils.js';

export default async function handler(req, res) {
  if (!requireMethod(req, res)) return;

  try {
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
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Could not load bid counts.' });
  }
}
