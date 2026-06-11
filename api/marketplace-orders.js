import {
  getUserFromRequest,
  sendJson,
  stripe,
  supabaseAdmin,
} from './_utils.js';
import { sendEmail, emailShell } from './_utils/email.js';
import { analyzePhotoBuffer } from './_utils/photoAnalysis.js';

const ADMIN_EMAIL = 'drewnegron95@gmail.com';
const HANDOFF_WINDOW_MS = 2 * 60 * 60 * 1000;
const SELLER_EVIDENCE_HOURS = 24;

async function downloadPhoto(path) {
  const { data, error } = await supabaseAdmin.storage
    .from('dispute-photos')
    .download(path);

  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

async function getOrder(orderId) {
  const { data, error } = await supabaseAdmin
    .from('marketplace_orders')
    .select('*, marketplace_listings(title, price)')
    .eq('id', orderId)
    .single();

  if (error) throw error;
  return data;
}

async function getProfileEmail(userId) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('email, name')
    .eq('id', userId)
    .single();
  return data;
}

async function isAdmin(user) {
  if (!user?.email) return false;
  return user.email.toLowerCase() === ADMIN_EMAIL;
}

async function releaseEscrow(order) {
  const pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
  if (pi.status === 'requires_capture') {
    await stripe.paymentIntents.capture(order.stripe_payment_intent_id);
  }

  const { data, error } = await supabaseAdmin
    .from('marketplace_orders')
    .update({
      status: 'completed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function refundEscrow(order) {
  const pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
  if (pi.status === 'requires_capture') {
    await stripe.paymentIntents.cancel(order.stripe_payment_intent_id);
  } else if (pi.status === 'succeeded') {
    await stripe.refunds.create({ payment_intent: order.stripe_payment_intent_id });
  }

  const { data, error } = await supabaseAdmin
    .from('marketplace_orders')
    .update({ status: 'refunded' })
    .eq('id', order.id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function markHandoff(req, res, user) {
  const { order_id: orderId, photo_path: photoPath } = req.body ?? {};
  if (!orderId || !photoPath) {
    sendJson(res, 400, { error: 'Order ID and photo path are required.' });
    return;
  }

  const order = await getOrder(orderId);
  if (order.seller_id !== user.id) {
    sendJson(res, 403, { error: 'Only the seller can mark handoff.' });
    return;
  }

  if (order.status !== 'held') {
    sendJson(res, 400, { error: 'Order must be in held status to mark handoff.' });
    return;
  }

  const buffer = await downloadPhoto(photoPath);
  const analysis = await analyzePhotoBuffer(buffer);
  const handoffAt = new Date().toISOString();

  const { data: updated, error } = await supabaseAdmin
    .from('marketplace_orders')
    .update({
      status: 'delivered_pending_confirmation',
      handoff_at: handoffAt,
      handoff_photo_url: photoPath,
      handoff_exif_data: analysis.exif,
      handoff_tamper_score: analysis.tamperScore,
      handoff_ai_summary: analysis.aiSummary,
    })
    .eq('id', orderId)
    .select('*')
    .single();

  if (error) throw error;

  const buyer = await getProfileEmail(order.buyer_id);
  if (buyer?.email) {
    await sendEmail({
      to: buyer.email,
      subject: 'Your PhillyGrind item has been marked as delivered',
      html: emailShell(
        'Confirm Receipt',
        `<p>Hi ${buyer.name || 'there'},</p>
         <p>Your item <strong>${order.marketplace_listings?.title || 'marketplace purchase'}</strong> has been marked as delivered by the seller.</p>
         <p>Please confirm receipt or open a dispute within <strong>2 hours</strong>. If you take no action, payment will automatically release to the seller.</p>
         <p><a href="https://phillygrind.work/marketplace/${order.listing_id}" style="display:inline-block;background:#11b874;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;">View Order</a></p>`,
      ),
    });
  }

  sendJson(res, 200, { order: updated });
}

async function confirmReceipt(req, res, user) {
  const { order_id: orderId } = req.body ?? {};
  if (!orderId) {
    sendJson(res, 400, { error: 'Order ID is required.' });
    return;
  }

  const order = await getOrder(orderId);
  if (order.buyer_id !== user.id) {
    sendJson(res, 403, { error: 'Only the buyer can confirm receipt.' });
    return;
  }

  if (order.status !== 'delivered_pending_confirmation') {
    sendJson(res, 400, { error: 'Order is not awaiting confirmation.' });
    return;
  }

  const updated = await releaseEscrow(order);
  sendJson(res, 200, { order: updated });
}

async function openDispute(req, res, user) {
  const { order_id: orderId, description, photo_path: photoPath } = req.body ?? {};
  if (!orderId || !description?.trim() || !photoPath) {
    sendJson(res, 400, { error: 'Description and evidence photo are required.' });
    return;
  }

  const order = await getOrder(orderId);
  if (order.buyer_id !== user.id) {
    sendJson(res, 403, { error: 'Only the buyer can open a dispute.' });
    return;
  }

  if (order.status !== 'delivered_pending_confirmation') {
    sendJson(res, 400, { error: 'Disputes can only be opened during the confirmation window.' });
    return;
  }

  const { data: existing } = await supabaseAdmin
    .from('disputes')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();

  if (existing) {
    sendJson(res, 400, { error: 'A dispute already exists for this order.' });
    return;
  }

  const buffer = await downloadPhoto(photoPath);
  const analysis = await analyzePhotoBuffer(buffer);
  const sellerDeadline = new Date(Date.now() + SELLER_EVIDENCE_HOURS * 60 * 60 * 1000).toISOString();

  const { data: dispute, error: disputeError } = await supabaseAdmin
    .from('disputes')
    .insert({
      order_id: orderId,
      buyer_description: description.trim(),
      buyer_photo_url: photoPath,
      buyer_exif_data: analysis.exif,
      buyer_tamper_score: analysis.tamperScore,
      buyer_ai_summary: analysis.aiSummary,
      seller_evidence_deadline: sellerDeadline,
      status: 'open',
    })
    .select('*')
    .single();

  if (disputeError) throw disputeError;

  const { error: orderError } = await supabaseAdmin
    .from('marketplace_orders')
    .update({ status: 'disputed' })
    .eq('id', orderId);

  if (orderError) throw orderError;

  const seller = await getProfileEmail(order.seller_id);
  if (seller?.email) {
    await sendEmail({
      to: seller.email,
      subject: 'A dispute has been opened on your PhillyGrind order',
      html: emailShell(
        'Dispute Opened',
        `<p>Hi ${seller.name || 'there'},</p>
         <p>A buyer has opened a dispute for <strong>${order.marketplace_listings?.title || 'your listing'}</strong>.</p>
         <p>You have <strong>24 hours</strong> to submit your evidence (description + photo) on the order page. You will not see the buyer's submission until an admin resolves the dispute.</p>
         <p><a href="https://phillygrind.work/marketplace/${order.listing_id}" style="display:inline-block;background:#11b874;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;">Submit Evidence</a></p>`,
      ),
    });
  }

  sendJson(res, 200, { dispute: filterDisputeForUser(dispute, order, user.id, false) });
}

async function submitSellerEvidence(req, res, user) {
  const { order_id: orderId, description, photo_path: photoPath } = req.body ?? {};
  if (!orderId || !description?.trim() || !photoPath) {
    sendJson(res, 400, { error: 'Description and evidence photo are required.' });
    return;
  }

  const order = await getOrder(orderId);
  if (order.seller_id !== user.id) {
    sendJson(res, 403, { error: 'Only the seller can submit evidence.' });
    return;
  }

  const { data: dispute, error: fetchError } = await supabaseAdmin
    .from('disputes')
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (fetchError) throw fetchError;
  if (dispute.status !== 'open') {
    sendJson(res, 400, { error: 'This dispute is already resolved.' });
    return;
  }
  if (dispute.seller_photo_url) {
    sendJson(res, 400, { error: 'Evidence has already been submitted.' });
    return;
  }

  const buffer = await downloadPhoto(photoPath);
  const analysis = await analyzePhotoBuffer(buffer);

  const { data: updated, error } = await supabaseAdmin
    .from('disputes')
    .update({
      seller_description: description.trim(),
      seller_photo_url: photoPath,
      seller_exif_data: analysis.exif,
      seller_tamper_score: analysis.tamperScore,
      seller_ai_summary: analysis.aiSummary,
    })
    .eq('id', dispute.id)
    .select('*')
    .single();

  if (error) throw error;
  sendJson(res, 200, { dispute: filterDisputeForUser(updated, order, user.id, false) });
}

function filterDisputeForUser(dispute, order, userId, adminView) {
  if (adminView) return dispute;

  const isBuyer = order.buyer_id === userId;
  const isSeller = order.seller_id === userId;

  if (dispute.status === 'resolved') return dispute;

  if (isBuyer) {
    return {
      id: dispute.id,
      order_id: dispute.order_id,
      status: dispute.status,
      resolution: dispute.resolution,
      created_at: dispute.created_at,
      seller_evidence_deadline: dispute.seller_evidence_deadline,
      buyer_description: dispute.buyer_description,
      buyer_photo_url: dispute.buyer_photo_url,
      buyer_exif_data: dispute.buyer_exif_data,
      buyer_tamper_score: dispute.buyer_tamper_score,
      buyer_ai_summary: dispute.buyer_ai_summary,
      seller_description: dispute.seller_description ? 'Submitted — visible after admin review' : null,
      seller_photo_url: dispute.seller_photo_url ? 'submitted' : null,
    };
  }

  if (isSeller) {
    return {
      id: dispute.id,
      order_id: dispute.order_id,
      status: dispute.status,
      resolution: dispute.resolution,
      created_at: dispute.created_at,
      seller_evidence_deadline: dispute.seller_evidence_deadline,
      seller_description: dispute.seller_description,
      seller_photo_url: dispute.seller_photo_url,
      seller_exif_data: dispute.seller_exif_data,
      seller_tamper_score: dispute.seller_tamper_score,
      seller_ai_summary: dispute.seller_ai_summary,
      buyer_description: dispute.buyer_description ? 'Submitted — visible after admin review' : null,
      buyer_photo_url: dispute.buyer_photo_url ? 'submitted' : null,
    };
  }

  return dispute;
}

async function getDispute(req, res, user) {
  const orderId = req.query.order_id;
  if (!orderId) {
    sendJson(res, 400, { error: 'Order ID is required.' });
    return;
  }

  const order = await getOrder(orderId);
  const adminView = await isAdmin(user);

  if (!adminView && order.buyer_id !== user.id && order.seller_id !== user.id) {
    sendJson(res, 403, { error: 'Access denied.' });
    return;
  }

  const { data: dispute, error } = await supabaseAdmin
    .from('disputes')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();

  if (error) throw error;
  if (!dispute) {
    sendJson(res, 404, { error: 'No dispute found.' });
    return;
  }

  sendJson(res, 200, {
    dispute: filterDisputeForUser(dispute, order, user.id, adminView),
  });
}

async function listDisputes(req, res, user) {
  if (!(await isAdmin(user))) {
    sendJson(res, 403, { error: 'Admin access required.' });
    return;
  }

  const status = req.query.status || 'open';
  const { data: disputes, error } = await supabaseAdmin
    .from('disputes')
    .select(`
      *,
      marketplace_orders(
        id, amount, listing_id, buyer_id, seller_id,
        marketplace_listings(title)
      )
    `)
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const enriched = await Promise.all((disputes ?? []).map(async (dispute) => {
    const order = dispute.marketplace_orders;
    const [buyer, seller] = await Promise.all([
      getProfileEmail(order?.buyer_id),
      getProfileEmail(order?.seller_id),
    ]);
    return {
      ...dispute,
      buyer_name: buyer?.name || 'Buyer',
      seller_name: seller?.name || 'Seller',
      item_name: order?.marketplace_listings?.title || 'Unknown item',
      amount: order?.amount,
      listing_id: order?.listing_id,
    };
  }));

  sendJson(res, 200, { disputes: enriched });
}

async function getDisputeDetail(req, res, user) {
  if (!(await isAdmin(user))) {
    sendJson(res, 403, { error: 'Admin access required.' });
    return;
  }

  const disputeId = req.query.dispute_id;
  if (!disputeId) {
    sendJson(res, 400, { error: 'Dispute ID is required.' });
    return;
  }

  const { data: dispute, error } = await supabaseAdmin
    .from('disputes')
    .select(`
      *,
      marketplace_orders(
        id, amount, listing_id, buyer_id, seller_id, stripe_payment_intent_id,
        marketplace_listings(title)
      )
    `)
    .eq('id', disputeId)
    .single();

  if (error) throw error;

  const order = dispute.marketplace_orders;
  const [buyer, seller] = await Promise.all([
    getProfileEmail(order?.buyer_id),
    getProfileEmail(order?.seller_id),
  ]);

  const photoUrls = {};
  for (const key of ['buyer_photo_url', 'seller_photo_url']) {
    if (dispute[key]) {
      const { data } = await supabaseAdmin.storage
        .from('dispute-photos')
        .createSignedUrl(dispute[key], 3600);
      photoUrls[key] = data?.signedUrl || null;
    }
  }

  sendJson(res, 200, {
    dispute: {
      ...dispute,
      buyer_name: buyer?.name || 'Buyer',
      seller_name: seller?.name || 'Seller',
      buyer_email: buyer?.email,
      seller_email: seller?.email,
      item_name: order?.marketplace_listings?.title || 'Unknown item',
      amount: order?.amount,
      listing_id: order?.listing_id,
      signed_photo_urls: photoUrls,
    },
  });
}

async function resolveDispute(req, res, user) {
  if (!(await isAdmin(user))) {
    sendJson(res, 403, { error: 'Admin access required.' });
    return;
  }

  const { dispute_id: disputeId, resolution } = req.body ?? {};
  if (!disputeId || !['released_to_seller', 'refunded_to_buyer'].includes(resolution)) {
    sendJson(res, 400, { error: 'Valid dispute ID and resolution are required.' });
    return;
  }

  const { data: dispute, error: fetchError } = await supabaseAdmin
    .from('disputes')
    .select('*, marketplace_orders(*)')
    .eq('id', disputeId)
    .single();

  if (fetchError) throw fetchError;
  if (dispute.status !== 'open') {
    sendJson(res, 400, { error: 'Dispute is already resolved.' });
    return;
  }

  const order = dispute.marketplace_orders;
  let updatedOrder;

  if (resolution === 'released_to_seller') {
    updatedOrder = await releaseEscrow(order);
  } else {
    updatedOrder = await refundEscrow(order);
  }

  const { data: updatedDispute, error: updateError } = await supabaseAdmin
    .from('disputes')
    .update({
      status: 'resolved',
      resolution,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', disputeId)
    .select('*')
    .single();

  if (updateError) throw updateError;

  const [buyer, seller] = await Promise.all([
    getProfileEmail(order.buyer_id),
    getProfileEmail(order.seller_id),
  ]);

  const outcomeText = resolution === 'released_to_seller'
    ? 'Payment has been released to the seller.'
    : 'Payment has been refunded to the buyer.';

  const emailBody = `<p>The dispute for <strong>${order.marketplace_listings?.title || 'your order'}</strong> has been resolved.</p>
    <p><strong>Outcome:</strong> ${outcomeText}</p>
    <p>Thank you for using PhillyGrind.</p>`;

  await Promise.all([
    buyer?.email && sendEmail({
      to: buyer.email,
      subject: 'Your PhillyGrind dispute has been resolved',
      html: emailShell('Dispute Resolved', `<p>Hi ${buyer.name || 'there'},</p>${emailBody}`),
    }),
    seller?.email && sendEmail({
      to: seller.email,
      subject: 'Your PhillyGrind dispute has been resolved',
      html: emailShell('Dispute Resolved', `<p>Hi ${seller.name || 'there'},</p>${emailBody}`),
    }),
  ].filter(Boolean));

  sendJson(res, 200, { dispute: updatedDispute, order: updatedOrder });
}

export async function autoReleaseMarketplaceOrders() {
  const cutoff = new Date(Date.now() - HANDOFF_WINDOW_MS).toISOString();

  const { data: dueOrders, error } = await supabaseAdmin
    .from('marketplace_orders')
    .select('id, stripe_payment_intent_id, listing_id')
    .eq('status', 'delivered_pending_confirmation')
    .lte('handoff_at', cutoff);

  if (error) throw error;

  const released = [];
  for (const order of dueOrders ?? []) {
    const { data: dispute } = await supabaseAdmin
      .from('disputes')
      .select('id')
      .eq('order_id', order.id)
      .maybeSingle();

    if (dispute) continue;

    try {
      await releaseEscrow(order);
      released.push(order.id);
    } catch (err) {
      console.warn(`Auto-release failed for marketplace order ${order.id}:`, err.message);
    }
  }

  return released;
}

export default async function handler(req, res) {
  const action = req.query.action;
  const readActions = new Set(['get-dispute', 'list-disputes', 'get-dispute-detail']);
  const method = readActions.has(action) ? 'GET' : 'POST';

  if (req.method !== method && !(action === 'auto-release' && (req.method === 'GET' || req.method === 'POST'))) {
    sendJson(res, 405, { error: `Method ${req.method} not allowed.` });
    return;
  }

  const isAutoRelease = action === 'auto-release' && (
    req.headers.authorization === `Bearer ${process.env.AUTO_RELEASE_SECRET || process.env.CRON_SECRET}`
    || req.headers['x-phillygrind-auto-release'] === process.env.AUTO_RELEASE_SECRET
  );

  if (isAutoRelease) {
    try {
      const released = await autoReleaseMarketplaceOrders();
      sendJson(res, 200, { released });
    } catch (error) {
      sendJson(res, 500, { error: error.message || 'Auto-release failed.' });
    }
    return;
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    sendJson(res, 401, { error: 'Authentication required.' });
    return;
  }

  try {
    switch (action) {
      case 'mark-handoff':
        await markHandoff(req, res, user);
        break;
      case 'confirm-receipt':
        await confirmReceipt(req, res, user);
        break;
      case 'open-dispute':
        await openDispute(req, res, user);
        break;
      case 'submit-seller-evidence':
        await submitSellerEvidence(req, res, user);
        break;
      case 'get-dispute':
        await getDispute(req, res, user);
        break;
      case 'list-disputes':
        await listDisputes(req, res, user);
        break;
      case 'get-dispute-detail':
        await getDisputeDetail(req, res, user);
        break;
      case 'resolve-dispute':
        await resolveDispute(req, res, user);
        break;
      default:
        sendJson(res, 400, { error: 'Unknown marketplace-orders action.' });
    }
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Marketplace order request failed.' });
  }
}
