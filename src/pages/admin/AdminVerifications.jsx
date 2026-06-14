import { BadgeCheck } from 'lucide-react';

export default function AdminVerifications() {
  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <BadgeCheck size={28} />
        <div>
          <h1>Verifications</h1>
          <p>Housing and identity verification tools</p>
        </div>
      </header>

      <div className="profile-section-card admin-coming-soon">
        <BadgeCheck size={48} />
        <h2>Coming soon</h2>
        <p>
          Housing verification, landlord checks, and identity review workflows will live here.
        </p>
      </div>
    </div>
  );
}
