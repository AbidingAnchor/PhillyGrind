import { getUserFromRequest, requireMethod, sendJson, supabaseAdmin } from './_utils.js';

export default async function handler(req, res) {
  if (!requireMethod(req, res)) return;

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
}
