import { buildAccountSnapshot } from './accountRecovery.js';
import {
  buildUserHistoryTimeline,
  caseTypeLabel,
  getPolicyContext,
  getUserActivity,
} from './adminCaseData.js';
import { supabaseAdmin } from '../_utils.js';

export async function loadRecoveryCaseDetail(caseId, { snapshotMode = 'frozen' } = {}) {
  const { data: request, error } = await supabaseAdmin
    .from('account_recovery_requests')
    .select('*')
    .eq('id', caseId)
    .maybeSingle();

  if (error) throw error;
  if (!request) {
    return { error: 'Case not found.', status: 404 };
  }

  const subjectUserId = request.claimed_user_id;
  const frozenSnapshot = request.snapshot || null;

  let liveSnapshot = null;
  if (snapshotMode === 'live' && subjectUserId) {
    liveSnapshot = await buildAccountSnapshot(subjectUserId);
  }

  const [activity, history] = await Promise.all([
    subjectUserId ? getUserActivity(subjectUserId) : Promise.resolve(null),
    subjectUserId ? buildUserHistoryTimeline(subjectUserId) : Promise.resolve([]),
  ]);

  const policyContext = getPolicyContext('recovery', request.identifier_raw);

  return {
    case: {
      type: 'recovery',
      type_label: caseTypeLabel('recovery'),
      id: request.id,
      status: request.status,
      created_at: request.created_at,
      reviewed_at: request.reviewed_at,
      subject_user_id: subjectUserId,
      identifier_raw: request.identifier_raw,
      new_email: request.new_email,
      requester_ip: request.requester_ip,
    },
    complaint: {
      type: 'recovery',
      identifier_raw: request.identifier_raw,
      new_email: request.new_email,
      requester_ip: request.requester_ip,
      questions_asked: request.questions_asked || [],
      answers: request.answers || {},
    },
    subject_snapshot: frozenSnapshot,
    frozen_snapshot: frozenSnapshot,
    live_snapshot: liveSnapshot,
    activity,
    history,
    policy_context: policyContext,
  };
}
