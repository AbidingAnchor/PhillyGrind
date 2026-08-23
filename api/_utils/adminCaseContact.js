import { buildAccountSnapshot } from './accountRecovery.js';
import {
  buildUserHistoryTimeline,
  caseTypeLabel,
  getPolicyContext,
  getUserActivity,
} from './adminCaseData.js';
import { supabaseAdmin } from '../_utils.js';

const CATEGORY_LABELS = {
  general: 'General',
  data_deletion: 'Data Deletion',
  fair_housing_complaint: 'Fair Housing Complaint',
  dispute_report: 'Dispute Report',
  other: 'Other',
};

export async function loadContactCaseDetail(caseId) {
  const { data: submission, error } = await supabaseAdmin
    .from('contact_submissions')
    .select('*')
    .eq('id', caseId)
    .maybeSingle();

  if (error) throw error;
  if (!submission) {
    return { error: 'Case not found.', status: 404 };
  }

  const { data: replies } = await supabaseAdmin
    .from('contact_replies')
    .select('id,message,sent_at,sent_by')
    .eq('contact_id', caseId)
    .order('sent_at', { ascending: true });

  const subjectUserId = submission.user_id || null;

  const [subjectSnapshot, activity, history] = await Promise.all([
    subjectUserId ? buildAccountSnapshot(subjectUserId) : Promise.resolve(null),
    subjectUserId ? getUserActivity(subjectUserId) : Promise.resolve(null),
    subjectUserId ? buildUserHistoryTimeline(subjectUserId) : Promise.resolve([]),
  ]);

  const policyContext = getPolicyContext('contact', submission.category);

  return {
    case: {
      type: 'contact',
      type_label: caseTypeLabel('contact'),
      id: submission.id,
      status: submission.status,
      created_at: submission.created_at,
      resolved_at: submission.resolved_at,
      subject_user_id: subjectUserId,
      category: submission.category,
      category_label: CATEGORY_LABELS[submission.category] || submission.category,
      reason: CATEGORY_LABELS[submission.category] || submission.category,
    },
    complaint: {
      type: 'contact',
      name: submission.name,
      email: submission.email,
      category: submission.category,
      category_label: CATEGORY_LABELS[submission.category] || submission.category,
      message: submission.message,
      replies: replies || [],
    },
    subject_snapshot: subjectSnapshot,
    activity,
    history,
    policy_context: policyContext,
  };
}
