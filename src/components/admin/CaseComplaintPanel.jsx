function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function formatValue(value) {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'object') {
    if (value.month || value.year) return `${value.month || '??'}/${value.year || '????'}`;
    return JSON.stringify(value);
  }
  return String(value);
}

function formatCents(cents) {
  return `$${((cents || 0) / 100).toFixed(2)}`;
}

function ListingFields({ listing, listingType }) {
  if (!listing) {
    return <p className="empty-state">Listing no longer available.</p>;
  }

  const fields = [
    ['Title', listing.title],
    ['Category', listing.category],
    ['Neighborhood', listing.neighborhood],
    ['Status', listing.status],
    ['Created', formatDate(listing.created_at)],
  ];

  if (listingType === 'gig' && listing.pay) fields.push(['Pay', listing.pay]);
  if (listingType === 'marketplace' && listing.price != null) fields.push(['Price', `$${listing.price}`]);
  if (listing.description) fields.push(['Description', listing.description]);

  return (
    <dl className="admin-case-dl">
      {fields.map(([label, value]) => (
        value != null && value !== '' ? (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{String(value)}</dd>
          </div>
        ) : null
      ))}
    </dl>
  );
}

function TamperBadge({ score }) {
  if (score == null) return null;
  const level = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
  return <span className={`tamper-badge tamper-${level}`}>Tamper score: {score}/100</span>;
}

function DisputeEvidence({ title, description, photoUrl, exif, tamperScore, aiSummary }) {
  return (
    <div className="admin-evidence-panel admin-case-evidence">
      <h3>{title}</h3>
      <p className="admin-evidence-desc">{description || 'No description provided.'}</p>
      {photoUrl && (
        <a href={photoUrl} target="_blank" rel="noopener noreferrer" className="admin-evidence-photo">
          <img src={photoUrl} alt={`${title} evidence`} />
        </a>
      )}
      <TamperBadge score={tamperScore} />
      {aiSummary && <p className="admin-ai-summary">{aiSummary}</p>}
      {exif && (
        <details className="admin-exif-details">
          <summary>EXIF Metadata</summary>
          <pre>{JSON.stringify(exif, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}

export default function CaseComplaintPanel({ caseRecord, complaint }) {
  const isReport = ['listing_report', 'user_report', 'community_report'].includes(caseRecord.type);
  const headline = caseRecord.type === 'contact'
    ? caseRecord.category_label
    : caseRecord.reason;

  return (
    <section className="admin-case-panel">
      <h2>{caseRecord.type === 'recovery' ? 'Submitted answers' : 'Case detail'}</h2>
      <div className="admin-case-complaint-reason">
        <span className="report-status-badge" data-status={caseRecord.status}>
          {caseRecord.status}
        </span>
        {headline && <p className="report-reason">{headline}</p>}
        {caseRecord.subreason && <p className="report-content-quote">{caseRecord.subreason}</p>}
        {caseRecord.details && <p className="report-content-quote">{caseRecord.details}</p>}
      </div>

      {caseRecord.reporter && (
        <div className="admin-case-reporter">
          <strong>Reporter</strong>
          <p>{caseRecord.reporter.name || 'User'} · {caseRecord.reporter.email || '—'}</p>
        </div>
      )}

      {complaint?.type === 'recovery' && (
        <div className="recovery-compare admin-case-recovery-answers">
          <dl className="admin-case-dl">
            <div><dt>Claimed as</dt><dd>{complaint.identifier_raw}</dd></div>
            <div><dt>New email</dt><dd>{complaint.new_email}</dd></div>
            <div><dt>Request IP</dt><dd>{complaint.requester_ip || '—'}</dd></div>
          </dl>
          {(complaint.questions_asked || []).map((question) => (
            <div key={question.id} className="admin-case-recovery-q">
              <strong>{question.prompt}</strong>
              <p>{formatValue(complaint.answers?.[question.id])}</p>
            </div>
          ))}
        </div>
      )}

      {complaint?.type === 'contact' && (
        <div>
          <dl className="admin-case-dl">
            <div><dt>From</dt><dd>{complaint.name}</dd></div>
            <div><dt>Email</dt><dd>{complaint.email}</dd></div>
            <div><dt>Category</dt><dd>{complaint.category_label}</dd></div>
            <div><dt>Submitted</dt><dd>{formatDate(caseRecord.created_at)}</dd></div>
          </dl>
          <blockquote className="report-content-quote">{complaint.message}</blockquote>
          {(complaint.replies || []).length > 0 && (
            <div className="admin-case-replies">
              <strong>Admin replies</strong>
              {complaint.replies.map((reply) => (
                <div key={reply.id} className="admin-case-reply">
                  <span className="admin-case-meta-line">{formatDate(reply.sent_at)}</span>
                  <p>{reply.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {complaint?.type === 'dispute' && (
        <div>
          <dl className="admin-case-dl">
            <div><dt>Item</dt><dd>{complaint.item_name}</dd></div>
            <div><dt>Escrow</dt><dd>{formatCents(complaint.amount)}</dd></div>
            <div><dt>Order</dt><dd>{complaint.order_id}</dd></div>
            <div><dt>Buyer</dt><dd>{complaint.buyer?.name || 'Buyer'} · {complaint.buyer?.email || '—'}</dd></div>
            <div><dt>Seller</dt><dd>{complaint.seller?.name || 'Seller'} · {complaint.seller?.email || '—'}</dd></div>
          </dl>
          <div className="admin-evidence-grid admin-case-evidence-grid">
            <DisputeEvidence
              title="Buyer evidence"
              description={complaint.buyer_description}
              photoUrl={complaint.signed_photo_urls?.buyer}
              exif={complaint.buyer_exif_data}
              tamperScore={complaint.buyer_tamper_score}
              aiSummary={complaint.buyer_ai_summary}
            />
            <DisputeEvidence
              title="Seller evidence"
              description={complaint.seller_description || (complaint.signed_photo_urls?.seller ? '' : 'Not yet submitted')}
              photoUrl={complaint.signed_photo_urls?.seller}
              exif={complaint.seller_exif_data}
              tamperScore={complaint.seller_tamper_score}
              aiSummary={complaint.seller_ai_summary}
            />
          </div>
        </div>
      )}

      {complaint?.type === 'user_profile' && (
        <div>
          <h3>Reported profile</h3>
          {complaint.profile ? (
            <dl className="admin-case-dl">
              <div><dt>Name</dt><dd>{complaint.profile.name || '—'}</dd></div>
              <div><dt>Email</dt><dd>{complaint.profile.email || '—'}</dd></div>
              <div><dt>Neighborhood</dt><dd>{complaint.profile.neighborhood || '—'}</dd></div>
              <div><dt>Bio</dt><dd>{complaint.profile.bio || '—'}</dd></div>
              <div><dt>Joined</dt><dd>{formatDate(complaint.profile.created_at)}</dd></div>
            </dl>
          ) : (
            <p className="empty-state">Profile not found.</p>
          )}
        </div>
      )}

      {complaint?.type === 'listing' && (
        <div>
          <h3>Reported listing ({complaint.listing_type})</h3>
          <ListingFields listing={complaint.listing} listingType={complaint.listing_type} />
        </div>
      )}

      {(complaint?.type === 'community_post' || complaint?.type === 'community_comment') && (
        <div>
          <h3>{complaint.type === 'community_post' ? 'Reported post' : 'Reported comment'}</h3>
          {complaint.content ? (
            <>
              <blockquote className="report-content-quote">{complaint.content.content}</blockquote>
              <p className="admin-case-meta-line">Posted {formatDate(complaint.content.created_at)}</p>
              {complaint.content.hidden && (
                <p className="form-status error-text">Hidden: {complaint.content.hidden_reason || 'moderation'}</p>
              )}
            </>
          ) : (
            <p className="empty-state">Content no longer available.</p>
          )}
        </div>
      )}

      {isReport && caseRecord.moderation_scores && (
        <div className="admin-case-moderation-scores">
          <strong>Auto-moderation scores</strong>
          <pre>{JSON.stringify(caseRecord.moderation_scores, null, 2)}</pre>
        </div>
      )}
    </section>
  );
}
