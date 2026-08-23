import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { caseQueueLabel, caseQueuePath, getAdminCaseDetail } from '../../lib/adminApi.js';
import { useAdminCounts } from '../../components/AdminLayout.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import UserSnapshotPanel from '../../components/admin/UserSnapshotPanel.jsx';
import CaseComplaintPanel from '../../components/admin/CaseComplaintPanel.jsx';
import UserActivityPanel from '../../components/admin/UserActivityPanel.jsx';
import UserHistoryTimeline from '../../components/admin/UserHistoryTimeline.jsx';
import GrindBotContextPanel from '../../components/admin/GrindBotContextPanel.jsx';
import CaseActionBar from '../../components/admin/CaseActionBar.jsx';

const VALID_TYPES = new Set([
  'listing_report',
  'user_report',
  'community_report',
  'recovery',
  'contact',
  'dispute',
]);

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function AdminCaseView() {
  const { caseType, caseId } = useParams();
  const navigate = useNavigate();
  const { loadCounts } = useAdminCounts();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveSnapshotEnabled, setLiveSnapshotEnabled] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);

  const backPath = caseQueuePath(caseType);
  const backLabel = caseQueueLabel(caseType);

  async function loadDetail({ snapshotMode, silent } = {}) {
    if (!VALID_TYPES.has(caseType)) {
      setError('Unknown case type.');
      setLoading(false);
      return;
    }

    try {
      if (!silent) setLoading(true);
      setError('');
      const data = await getAdminCaseDetail(caseType, caseId, { snapshotMode });
      setDetail(data);
    } catch (err) {
      setError(err.message);
      if (!silent) setDetail(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    setLiveSnapshotEnabled(false);
    loadDetail();
  }, [caseType, caseId]);

  async function handleToggleLive(enabled) {
    setLiveSnapshotEnabled(enabled);
    if (!enabled) return;
    setLiveLoading(true);
    try {
      await loadDetail({ snapshotMode: 'live', silent: true });
    } finally {
      setLiveLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="admin-page admin-case-view">
        <Skeleton variant="list" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="admin-page admin-case-view">
        <Link to={backPath} className="admin-case-back">
          <ArrowLeft size={16} /> {backLabel}
        </Link>
        <p className="form-status error-text">{error || 'Case not found.'}</p>
      </div>
    );
  }

  const {
    case: caseRecord,
    complaint,
    subject_snapshot,
    frozen_snapshot,
    live_snapshot,
    activity,
    history,
    policy_context,
  } = detail;

  const isRecovery = caseType === 'recovery';
  const snapshotTitle = caseType === 'contact' && !subject_snapshot
    ? 'Submitter account'
    : caseType === 'dispute'
      ? 'Buyer account'
      : 'Subject account';

  return (
    <div className="admin-page admin-case-view">
      <header className="admin-page-header admin-case-header">
        <Link to={backPath} className="admin-case-back">
          <ArrowLeft size={16} /> {backLabel}
        </Link>
        <div className="admin-case-header-main">
          <ClipboardList size={28} />
          <div>
            <h1>{caseRecord.type_label}</h1>
            <p>
              Case {caseRecord.id.slice(0, 8)}… · Filed {formatDate(caseRecord.created_at)}
            </p>
          </div>
          <span className="report-status-badge" data-status={caseRecord.status}>
            {caseRecord.status}
          </span>
        </div>
      </header>

      <div className="admin-case-grid">
        <div className="admin-case-column">
          <UserSnapshotPanel
            snapshot={subject_snapshot}
            title={snapshotTitle}
            recoveryMode={isRecovery}
            frozenSnapshot={frozen_snapshot ?? subject_snapshot}
            liveSnapshot={live_snapshot}
            liveEnabled={liveSnapshotEnabled}
            onToggleLive={handleToggleLive}
            liveLoading={liveLoading}
          />
          <UserActivityPanel activity={activity} />
        </div>
        <div className="admin-case-column">
          <CaseComplaintPanel caseRecord={caseRecord} complaint={complaint} />
          <GrindBotContextPanel policyContext={policy_context} />
        </div>
      </div>

      <UserHistoryTimeline history={history} />

      <CaseActionBar
        caseRecord={caseRecord}
        onResolved={async () => {
          await loadDetail({ silent: true });
          await loadCounts();
        }}
        onDeleted={() => navigate(backPath)}
      />
    </div>
  );
}
