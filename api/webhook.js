import Stripe from 'stripe';
import { stripe, supabaseAdmin } from './_utils.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (chunk) => chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const rawBody = await buffer(req);
    const signature = req.headers['stripe-signature'];
    const event = process.env.STRIPE_WEBHOOK_SECRET
      ? stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)
      : JSON.parse(rawBody.toString('utf8'));

    if (event.type === 'payment_intent.amount_capturable_updated') {
      const paymentIntent = event.data.object;
      const listingType = paymentIntent.metadata?.listing_type;
      
      if (listingType === 'marketplace') {
        await supabaseAdmin
          .from('marketplace_orders')
          .update({ status: 'held' })
          .eq('stripe_payment_intent_id', paymentIntent.id);
      } else {
        await supabaseAdmin
          .from('orders')
          .update({ status: 'escrowed' })
          .eq('stripe_payment_intent_id', paymentIntent.id);
      }
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const listingType = paymentIntent.metadata?.listing_type;
      
      if (listingType === 'marketplace') {
        // Marketplace orders stay in 'held' status until buyer confirms receipt
        // No status change needed here
      } else {
        await supabaseAdmin
          .from('orders')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            released_at: new Date().toISOString(),
          })
          .eq('stripe_payment_intent_id', paymentIntent.id);
      }
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.mode === 'subscription' && session.metadata?.listing_id && session.metadata?.listing_type && session.metadata?.boost_tier) {
        const listingType = session.metadata.listing_type;
        const table = listingType === 'gig' ? 'gigs' : listingType === 'job' ? 'jobs' : null;
        const tier = session.metadata.boost_tier;

        if (table && ['basic', 'pro'].includes(tier)) {
          const boostExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          await supabaseAdmin
            .from(table)
            .update({
              is_boosted: true,
              boost_tier: tier,
              boost_expires_at: boostExpiresAt,
              boost_pending: false,
            })
            .eq('id', session.metadata.listing_id);
        }
      }
    }

    if (event.type === 'account.updated') {
      const account = event.data.object;
      const userId = account.metadata?.user_id;
      if (userId) {
        await supabaseAdmin
          .from('profiles')
          .update({
            stripe_account_id: account.id,
            stripe_onboarding_complete: Boolean(account.charges_enabled && account.payouts_enabled),
          })
          .eq('id', userId);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      res.status(400).json({ error: 'Invalid webhook signature.' });
      return;
    }

    res.status(500).json({ error: error.message || 'Webhook error.' });
  }
}
