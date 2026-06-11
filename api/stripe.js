import {
  findListing,
  getUserFromRequest,
  hasServerSupabaseConfig,
  hasValidServerSupabaseUrl,
  normalizeAmount,
  requireMethod,
  sendJson,
  serverSupabaseUrl,
  stripe,
  supabaseAdmin,
} from './_utils.js';

const boostPrices = {
  basic: 1999,
  pro: 3999,
};

function parseListingPayToCents(pay) {
  const match = String(pay || '').replace(/,/g, '').match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  if (!match) {
    throw new Error('The gig listing needs a valid fixed rate before escrow can be funded.');
  }

  return Math.round(Number(match[1]) * 100);
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (Array.isArray(header)) return header[0]?.replace(/^Bearer\s+/i, '').trim();
  return header?.replace(/^Bearer\s+/i, '').trim();
}

function tableFor(listingType) {
  return listingType === 'gig' ? 'gigs' : 'jobs';
}

function pathFor(listingType) {
  return listingType === 'gig' ? 'gigs' : 'jobs';
}

async function createPaymentIntent(req, res, user) {
  const { listing_id: listingId, amount, accepted_bid_id: acceptedBidId } = req.body ?? {};
  const listing = await findListing(listingId);

  if (!listing) {
    sendJson(res, 404, { error: 'Listing not found.' });
    return;
  }

  if (!['gig', 'marketplace'].includes(listing.listing_type)) {
    sendJson(res, 400, { error: 'Payments are only available for gigs and marketplace listings.' });
    return;
  }

  let workerId = listing.user_id;
  let amountCents;

  if (listing.listing_type === 'marketplace') {
    if (listing.user_id === user.id) {
      sendJson(res, 400, { error: 'You cannot buy your own listing.' });
      return;
    }

    if (listing.payment_type === 'cash') {
      sendJson(res, 400, { error: 'This listing only accepts cash payments.' });
      return;
    }

    if (listing.status && listing.status !== 'active') {
      sendJson(res, 400, { error: 'This listing is no longer available.' });
      return;
    }

    amountCents = normalizeAmount(amount || parseListingPayToCents(listing.price));
  } else if (acceptedBidId) {
    if (listing.user_id !== user.id) {
      sendJson(res, 403, { error: 'Only the gig poster can pay an accepted bid.' });
      return;
    }

    const { data: acceptedBid, error: bidError } = await supabaseAdmin
      .from('bids')
      .select('id,listing_id,worker_id,status')
      .eq('id', acceptedBidId)
      .eq('listing_id', listingId)
      .maybeSingle();

    if (bidError) throw bidError;

    if (!acceptedBid || acceptedBid.status !== 'accepted') {
      sendJson(res, 400, { error: 'A valid accepted bid is required before payment.' });
      return;
    }

    workerId = acceptedBid.worker_id;
    amountCents = parseListingPayToCents(listing.pay);
  } else if (listing.user_id === user.id) {
    sendJson(res, 400, { error: 'You cannot hire yourself.' });
    return;
  } else if (listing.post_type !== 'offering') {
    sendJson(res, 400, { error: 'Payments are only available for worker service gigs.' });
    return;
  } else {
    amountCents = normalizeAmount(amount);
  }

  if (workerId === user.id) {
    sendJson(res, 400, { error: 'You cannot hire yourself.' });
    return;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('stripe_account_id,stripe_onboarding_complete')
    .eq('id', workerId)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!profile?.stripe_account_id) {
    sendJson(res, 400, { error: 'The worker has not connected Stripe yet.' });
    return;
  }

  const workerAccount = await stripe.accounts.retrieve(profile.stripe_account_id);
  const workerStripeReady = Boolean(workerAccount.charges_enabled && workerAccount.payouts_enabled);

  if (workerStripeReady !== Boolean(profile.stripe_onboarding_complete)) {
    await supabaseAdmin
      .from('profiles')
      .update({ stripe_onboarding_complete: workerStripeReady })
      .eq('id', workerId);
  }

  if (!workerStripeReady) {
    sendJson(res, 400, { error: 'The worker has not finished Stripe Express onboarding yet.' });
    return;
  }

  const applicationFeeAmount = Math.round(amountCents * 0.08);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    capture_method: 'manual',
    automatic_payment_methods: { enabled: true },
    application_fee_amount: applicationFeeAmount,
    transfer_data: {
      destination: profile.stripe_account_id,
    },
    metadata: {
      listing_id: listingId,
      hirer_id: user.id,
      worker_id: workerId,
      accepted_bid_id: acceptedBidId || '',
      application_fee_amount: String(applicationFeeAmount),
      listing_type: listing.listing_type,
    },
  });

  let order;
  if (listing.listing_type === 'marketplace') {
    const { data: marketplaceOrder, error: marketplaceOrderError } = await supabaseAdmin
      .from('marketplace_orders')
      .insert({
        listing_id: listingId,
        buyer_id: user.id,
        seller_id: workerId,
        amount: amountCents,
        fee: applicationFeeAmount,
        status: 'pending',
        stripe_payment_intent_id: paymentIntent.id,
      })
      .select('id,status,amount,fee,stripe_payment_intent_id')
      .single();

    if (marketplaceOrderError) throw marketplaceOrderError;
    order = marketplaceOrder;
  } else {
    const { data: gigOrder, error: gigOrderError } = await supabaseAdmin
      .from('orders')
      .insert({
        listing_id: listingId,
        hirer_id: user.id,
        worker_id: workerId,
        amount: amountCents,
        status: 'pending',
        stripe_payment_intent_id: paymentIntent.id,
      })
      .select('id,status,amount,stripe_payment_intent_id')
      .single();

    if (gigOrderError) throw gigOrderError;
    order = gigOrder;
  }

  sendJson(res, 200, {
    clientSecret: paymentIntent.client_secret,
    order,
    applicationFeeAmount,
  });
}

async function createBoostCheckout(req, res, user) {
  const { listing_id: listingId, listing_type: listingType, tier } = req.body ?? {};
  if (!listingId || !['job', 'gig'].includes(listingType) || !['basic', 'pro'].includes(tier)) {
    sendJson(res, 400, { error: 'A valid listing, listing type, and boost tier are required.' });
    return;
  }

  const { data: listing, error: listingError } = await supabaseAdmin
    .from(tableFor(listingType))
    .select('id,user_id,title')
    .eq('id', listingId)
    .maybeSingle();

  if (listingError) throw listingError;
  if (!listing) {
    sendJson(res, 404, { error: 'Listing not found.' });
    return;
  }

  if (listing.user_id !== user.id) {
    sendJson(res, 403, { error: 'Only the listing owner can boost this listing.' });
    return;
  }

  const origin = req.headers.origin || process.env.APP_URL || 'http://localhost:5173';
  const listingPath = `${origin}/${pathFor(listingType)}/${listingId}`;
  const label = tier === 'pro' ? 'Pro Boost' : 'Basic Boost';

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: user.email || undefined,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: boostPrices[tier],
          recurring: { interval: 'month' },
          product_data: {
            name: `PhillyGrind ${label}`,
            description: `${label} for ${listing.title}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      listing_id: listingId,
      listing_type: listingType,
      boost_tier: tier,
      user_id: user.id,
    },
    subscription_data: {
      metadata: {
        listing_id: listingId,
        listing_type: listingType,
        boost_tier: tier,
        user_id: user.id,
      },
    },
    success_url: `${listingPath}?boost=success&tier=${tier}`,
    cancel_url: `${listingPath}?boost=cancelled&tier=${tier}`,
  });

  sendJson(res, 200, { url: session.url });
}

async function ensureConnectAccount(user, profile) {
  const storedAccountId = profile?.stripe_account_id?.trim() || null;

  if (storedAccountId) {
    try {
      const existing = await stripe.accounts.retrieve(storedAccountId);
      if (existing?.id && !existing.deleted) {
        return storedAccountId;
      }
    } catch (error) {
      console.warn('Stored Stripe Connect account is invalid; creating a new one.', {
        userId: user.id,
        storedAccountId,
        message: error.message,
      });
    }
  }

  const account = await stripe.accounts.create({
    type: 'express',
    email: user.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { user_id: user.id },
  });

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: user.id,
      name: profile?.name || user.user_metadata?.name || user.email?.split('@')[0] || 'PhillyGrind user',
      email: profile?.email || user.email,
      stripe_account_id: account.id,
      stripe_onboarding_complete: false,
    }, { onConflict: 'id' });

  if (updateError) throw updateError;
  return account.id;
}

async function createConnectAccount(req, res) {
  const token = getBearerToken(req);

  if (!hasServerSupabaseConfig) {
    sendJson(res, 500, {
      error: 'Supabase server credentials are missing or invalid. In Vercel, set SUPABASE_URL to the full URL like https://xxxx.supabase.co and set SUPABASE_SERVICE_ROLE_KEY.',
    });
    return;
  }

  if (!token) {
    sendJson(res, 401, { error: 'Authentication required.' });
    return;
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    console.warn('Stripe Connect token verification failed', {
      message: userError?.message || null,
      status: userError?.status || null,
      hasUser: Boolean(userData?.user),
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
      supabaseUrlPreview: serverSupabaseUrl
        ? `${serverSupabaseUrl.slice(0, 18)}...${serverSupabaseUrl.slice(-12)}`
        : null,
      hasValidSupabaseUrl: hasValidServerSupabaseUrl,
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    });
    sendJson(res, 401, { error: 'Authentication required.' });
    return;
  }

  const user = userData.user;
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id,stripe_account_id,email,name')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  const accountId = await ensureConnectAccount(user, profile);

  const origin = req.headers.origin || process.env.APP_URL || 'http://localhost:5173';
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/profile`,
    return_url: `${origin}/profile`,
    type: 'account_onboarding',
  });

  sendJson(res, 200, { accountId, url: accountLink.url });
}

async function checkConnectStatus(req, res, user) {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id,stripe_account_id,stripe_onboarding_complete')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!profile?.stripe_account_id) {
    sendJson(res, 200, {
      stripe_account_id: null,
      charges_enabled: false,
      payouts_enabled: false,
      stripe_onboarding_complete: false,
    });
    return;
  }

  const account = await stripe.accounts.retrieve(profile.stripe_account_id);
  const chargesEnabled = Boolean(account.charges_enabled);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  const onboardingComplete = chargesEnabled && payoutsEnabled;

  if (onboardingComplete !== Boolean(profile.stripe_onboarding_complete)) {
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ stripe_onboarding_complete: onboardingComplete })
      .eq('id', user.id);

    if (updateError) throw updateError;
  }

  sendJson(res, 200, {
    stripe_account_id: profile.stripe_account_id,
    charges_enabled: chargesEnabled,
    payouts_enabled: payoutsEnabled,
    stripe_onboarding_complete: onboardingComplete,
  });
}

export default async function handler(req, res) {
  if (!requireMethod(req, res)) return;

  const action = req.query.action;
  const authRequiredActions = new Set([
    'create-payment-intent',
    'create-boost-checkout',
    'check-connect-status',
  ]);

  try {
    let user = null;
    if (authRequiredActions.has(action)) {
      user = await getUserFromRequest(req);
      if (!user) {
        sendJson(res, 401, { error: 'Authentication required.' });
        return;
      }
    }

    if (action === 'create-payment-intent') {
      await createPaymentIntent(req, res, user);
      return;
    }

    if (action === 'create-boost-checkout') {
      await createBoostCheckout(req, res, user);
      return;
    }

    if (action === 'create-connect-account') {
      await createConnectAccount(req, res);
      return;
    }

    if (action === 'check-connect-status') {
      await checkConnectStatus(req, res, user);
      return;
    }

    sendJson(res, 400, { error: 'Unknown Stripe action.' });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Stripe request failed.' });
  }
}
