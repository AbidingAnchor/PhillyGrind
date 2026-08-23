import { buildAccountSnapshot } from './accountRecovery.js';
import {
  buildUserHistoryTimeline,
  caseTypeLabel,
  getPolicyContext,
  getUserActivity,
} from './adminCaseData.js';
import { supabaseAdmin } from '../_utils.js';

async function getProfile(userId) {
  if (!userId) return null;
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id,name,email')
    .eq('id', userId)
    .maybeSingle();
  return data;
}

export async function loadDisputeCaseDetail(caseId) {
  const { data: dispute, error } = await supabaseAdmin
    .from('disputes')
    .select(`
      *,
      marketplace_orders(
        id, amount, listing_id, buyer_id, seller_id, stripe_payment_intent_id,
        marketplace_listings(title)
      )
    `)
    .eq('id', caseId)
    .maybeSingle();

  if (error) throw error;
  if (!dispute) {
    return { error: 'Case not found.', status: 404 };
  }

  const order = dispute.marketplace_orders;
  const buyerId = order?.buyer_id || null;
  const sellerId = order?.seller_id || null;

  const [buyer, seller] = await Promise.all([
    getProfile(buyerId),
    getProfile(sellerId),
  ]);

  const photoUrls = {};
  for (const key of ['buyer_photo_url', 'seller_photo_url']) {
    if (dispute[key]) {
      const { data } = await supabaseAdmin.storage
        .from('dispute-photos')
        .createSignedUrl(dispute[key], 3600);
      photoUrls[key.replace('_photo_url', '')] = data?.signedUrl || null;
    }
  }

  const subjectUserId = buyerId;

  const [subjectSnapshot, activity, history] = await Promise.all([
    subjectUserId ? buildAccountSnapshot(subjectUserId) : Promise.resolve(null),
    subjectUserId ? getUserActivity(subjectUserId) : Promise.resolve(null),
    subjectUserId ? buildUserHistoryTimeline(subjectUserId) : Promise.resolve([]),
  ]);

  const policyContext = getPolicyContext('dispute');

  return {
    case: {
      type: 'dispute',
      type_label: caseTypeLabel('dispute'),
      id: dispute.id,
      status: dispute.status,
      created_at: dispute.created_at,
      resolved_at: dispute.resolved_at,
      resolution: dispute.resolution,
      subject_user_id: subjectUserId,
      order_id: order?.id,
      listing_id: order?.listing_id,
      amount: order?.amount,
      reason: dispute.buyer_description?.slice(0, 120) || 'Marketplace dispute',
    },
    complaint: {
      type: 'dispute',
      item_name: order?.marketplace_listings?.title || 'Unknown item',
      amount: order?.amount,
      order_id: order?.id,
      listing_id: order?.listing_id,
      buyer,
      seller,
      buyer_description: dispute.buyer_description,
      seller_description: dispute.seller_description,
      buyer_exif_data: dispute.buyer_exif_data,
      seller_exif_data: dispute.seller_exif_data,
      buyer_tamper_score: dispute.buyer_tamper_score,
      seller_tamper_score: dispute.seller_tamper_score,
      buyer_ai_summary: dispute.buyer_ai_summary,
      seller_ai_summary: dispute.seller_ai_summary,
      signed_photo_urls: {
        buyer: photoUrls.buyer || null,
        seller: photoUrls.seller || null,
      },
      seller_evidence_deadline: dispute.seller_evidence_deadline,
    },
    subject_snapshot: subjectSnapshot,
    activity,
    history,
    policy_context: policyContext,
  };
}
