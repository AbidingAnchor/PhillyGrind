import { sendJson, stripe, supabaseAdmin } from './_utils.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    sendJson(res, 405, { error: `Method ${req.method} not allowed.` });
    return;
  }

  const expectedSecret = process.env.AUTO_RELEASE_SECRET || process.env.CRON_SECRET;
  if (expectedSecret && req.headers.authorization !== `Bearer ${expectedSecret}`) {
    sendJson(res, 401, { error: 'Unauthorized.' });
    return;
  }

  try {
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: dueOrders, error } = await supabaseAdmin
      .from('orders')
      .select('id,stripe_payment_intent_id')
      .eq('status', 'completed')
      .is('released_at', null)
      .lte('worker_marked_complete_at', cutoff);

    if (error) throw error;

    const released = [];
    for (const order of dueOrders ?? []) {
      try {
        await stripe.paymentIntents.capture(order.stripe_payment_intent_id);
        const { error: updateError } = await supabaseAdmin
          .from('orders')
          .update({
            completed_at: new Date().toISOString(),
            released_at: new Date().toISOString(),
          })
          .eq('id', order.id);

        if (updateError) throw updateError;
        released.push(order.id);
      } catch (error) {
        console.warn(`Auto-release failed for order ${order.id}:`, error.message);
      }
    }

    sendJson(res, 200, { released });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Could not auto-release payments.' });
  }
}
