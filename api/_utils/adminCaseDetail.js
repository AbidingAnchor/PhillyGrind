import { buildAccountSnapshot } from './accountRecovery.js';
import { loadContactCaseDetail } from './adminCaseContact.js';
import { loadDisputeCaseDetail } from './adminCaseDisputes.js';
import { loadRecoveryCaseDetail } from './adminCaseRecovery.js';
import {
  buildUserHistoryTimeline,
  caseTypeLabel,
  getPolicyContext,
  getUserActivity,
} from './adminCaseData.js';
import { supabaseAdmin } from '../_utils.js';

const VALID_CASE_TYPES = new Set(['listing_report', 'user_report', 'community_report']);

async function loadReporter(reporterId) {
  if (!reporterId) return null;
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id,name,email')
    .eq('id', reporterId)
    .maybeSingle();
  return data;
}

async function loadListingContent(listingType, listingId) {
  const table = listingType === 'gig'
    ? 'gigs'
    : listingType === 'marketplace'
      ? 'marketplace_listings'
      : 'jobs';

  const { data, error } = await supabaseAdmin
    .from(table)
    .select('*')
    .eq('id', listingId)
    .maybeSingle();

  if (error) throw error;
  return { table, listing: data };
}

async function resolveSubjectFromListing(listingType, listingId) {
  const { listing } = await loadListingContent(listingType, listingId);
  return {
    subjectUserId: listing?.user_id || null,
    listing,
    listingTable: listingType,
  };
}

async function loadCommunityContent(postId, commentId) {
  if (commentId) {
    const { data: comment, error } = await supabaseAdmin
      .from('community_comments')
      .select('id,content,created_at,user_id,post_id,hidden,hidden_reason')
      .eq('id', commentId)
      .maybeSingle();
    if (error) throw error;
    return {
      contentType: 'community_comment',
      content: comment,
      subjectUserId: comment?.user_id || null,
    };
  }

  if (postId) {
    const { data: post, error } = await supabaseAdmin
      .from('community_posts')
      .select('id,content,created_at,user_id,hidden,hidden_reason')
      .eq('id', postId)
      .maybeSingle();
    if (error) throw error;
    return {
      contentType: 'community_post',
      content: post,
      subjectUserId: post?.user_id || null,
    };
  }

  return { contentType: null, content: null, subjectUserId: null };
}

async function loadListingReport(caseId) {
  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .select('*')
    .eq('id', caseId)
    .maybeSingle();

  if (error) throw error;
  if (!report) return null;

  const caseType = report.reported_type === 'user' ? 'user_report' : 'listing_report';

  let subjectUserId = null;
  let complaint = {};

  if (report.reported_type === 'user') {
    subjectUserId = report.reported_id;
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id,name,email,neighborhood,created_at,bio')
      .eq('id', report.reported_id)
      .maybeSingle();
    complaint = {
      type: 'user_profile',
      profile,
    };
  } else {
    const resolved = await resolveSubjectFromListing(report.listing_type, report.reported_id);
    subjectUserId = resolved.subjectUserId;
    complaint = {
      type: 'listing',
      listing_type: report.listing_type,
      listing: resolved.listing,
    };
  }

  const reporter = await loadReporter(report.reporter_id);

  return {
    case: {
      type: caseType,
      id: report.id,
      status: report.status,
      created_at: report.created_at,
      resolved_at: report.resolved_at,
      reason: report.reason,
      subreason: null,
      source: report.source || 'user',
      reporter,
      subject_user_id: subjectUserId,
      moderation_scores: report.moderation_scores,
      reported_type: report.reported_type,
      listing_type: report.listing_type,
      reported_id: report.reported_id,
    },
    complaint,
  };
}

async function loadCommunityReport(caseId) {
  const { data: report, error } = await supabaseAdmin
    .from('community_reports')
    .select('*')
    .eq('id', caseId)
    .maybeSingle();

  if (error) throw error;
  if (!report) return null;

  const communityContent = await loadCommunityContent(report.post_id, report.comment_id);
  const reporter = await loadReporter(report.reporter_id);

  return {
    case: {
      type: 'community_report',
      id: report.id,
      status: report.status || 'pending',
      created_at: report.created_at,
      resolved_at: report.resolved_at,
      reason: report.reason,
      subreason: report.subreason,
      details: report.details,
      source: 'community',
      reporter,
      subject_user_id: communityContent.subjectUserId,
      post_id: report.post_id,
      comment_id: report.comment_id,
    },
    complaint: {
      type: communityContent.contentType,
      content: communityContent.content,
    },
  };
}

export async function loadReportCaseDetail(caseType, caseId) {
  if (!VALID_CASE_TYPES.has(caseType)) {
    return { error: 'Invalid case type.', status: 400 };
  }

  let loaded;
  if (caseType === 'community_report') {
    loaded = await loadCommunityReport(caseId);
  } else {
    loaded = await loadListingReport(caseId);
    if (loaded && loaded.case.type !== caseType) {
      return { error: 'Case type does not match report record.', status: 404 };
    }
  }

  if (!loaded) {
    return { error: 'Case not found.', status: 404 };
  }

  const { case: caseRecord, complaint } = loaded;
  const subjectUserId = caseRecord.subject_user_id;

  const [subjectSnapshot, activity, history, reporterSnapshot] = await Promise.all([
    subjectUserId ? buildAccountSnapshot(subjectUserId) : Promise.resolve(null),
    subjectUserId ? getUserActivity(subjectUserId) : Promise.resolve(null),
    subjectUserId ? buildUserHistoryTimeline(subjectUserId) : Promise.resolve([]),
    caseRecord.reporter?.id ? buildAccountSnapshot(caseRecord.reporter.id) : Promise.resolve(null),
  ]);

  const policyContext = getPolicyContext(
    caseRecord.type,
    caseRecord.reason,
    caseRecord.subreason,
  );

  return {
    case: {
      ...caseRecord,
      type_label: caseTypeLabel(caseRecord.type),
    },
    complaint,
    subject_snapshot: subjectSnapshot,
    activity,
    history,
    reporter_snapshot: reporterSnapshot,
    policy_context: policyContext,
  };
}

const REPORT_CASE_TYPES = new Set(['listing_report', 'user_report', 'community_report']);
const ALL_CASE_TYPES = new Set([...REPORT_CASE_TYPES, 'recovery', 'contact', 'dispute']);

export async function loadCaseDetail(caseType, caseId, options = {}) {
  if (!ALL_CASE_TYPES.has(caseType)) {
    return { error: 'Invalid case type.', status: 400 };
  }

  if (REPORT_CASE_TYPES.has(caseType)) {
    return loadReportCaseDetail(caseType, caseId);
  }

  if (caseType === 'recovery') {
    return loadRecoveryCaseDetail(caseId, options);
  }

  if (caseType === 'contact') {
    return loadContactCaseDetail(caseId);
  }

  if (caseType === 'dispute') {
    return loadDisputeCaseDetail(caseId);
  }

  return { error: 'Invalid case type.', status: 400 };
}
