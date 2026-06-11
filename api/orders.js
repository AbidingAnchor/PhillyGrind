import { getUserFromRequest, requireMethod, sendJson, stripe, supabaseAdmin } from './_utils.js';

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

export default async function handler(req, res) {
  if (!requireMethod(req, res)) return;

  try {
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
