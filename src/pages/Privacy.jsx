function Privacy() {
  return (
    <section className="legal-page">
      <div className="page-heading">
        <span className="eyebrow">Privacy</span>
        <h1>Privacy Policy</h1>
        <p>Last Updated: June 2, 2026</p>
      </div>

      <article className="legal-card">
        <h2>1. Information We Collect</h2>
        <p>We collect account data such as your email address, display name, and account settings. We collect listing information you post, including job or gig details, category, pay, neighborhood, and descriptions.</p>
        <p>We store chat logs and photos shared through the Platform so users can communicate and so PhillyGrind can review relevant records for disputes, fraud prevention, safety, and platform enforcement.</p>
        <p>PhillyGrind does not store credit card numbers, bank account numbers, or sensitive financial credentials. Stripe handles all financial data and payment processing.</p>
        <p>Location information is limited to neighborhood-level location data. PhillyGrind does not require or publicly display exact addresses.</p>

        <h2>2. How We Use Your Information</h2>
        <p>We use your information to operate the Platform, create and manage accounts, publish listings, match hirers and workers, enable messaging, support escrow payment workflows, resolve disputes, prevent fraud, enforce policies, and comply with legal obligations.</p>

        <h2>3. Sharing and Disclosure</h2>
        <p>PhillyGrind does not sell user data to third parties. Your display name and neighborhood may be visible to other users as part of account, listing, messaging, or review features.</p>
        <p>Chat logs, photos, listing details, and transaction-related information may be shared with Stripe, law enforcement, courts, regulators, or other necessary parties for payment disputes, fraud investigations, safety issues, legal compliance, or valid legal mandates from Pennsylvania courts.</p>

        <h2>4. Data Security and Retention</h2>
        <p>We use industry-standard security practices designed to protect user data. No system is perfectly secure, and PhillyGrind cannot guarantee absolute security.</p>
        <p>We retain data while your account is active or as needed for listings, messages, payments, dispute resolution, fraud prevention, legal compliance, tax records, or enforcement of our Terms.</p>

        <h2>5. Children's Privacy</h2>
        <p>PhillyGrind is for users 18 and older. We do not knowingly collect data from children under 13. If we discover that a user is under 18, or that we have collected data from a child under 13, we will immediately terminate the account and delete the data where required by law.</p>

        <h2>6. Marketplace Data Collection</h2>
        <p>When you use the PhillyGrind Marketplace, we collect listing information including item descriptions, photos, pricing, and location. For Secure Checkout transactions, payment information is processed and stored securely by Stripe. PhillyGrind does not store your full credit card details.</p>

        <h2>7. Data Sharing Between Users</h2>
        <p>To facilitate transactions, basic contact information may be shared between buyers and sellers through our in-app messaging system. We do not share your personal information with third parties outside of what is necessary to complete a transaction.</p>

        <h2>8. Third-Party Payment Processing</h2>
        <p>All Secure Checkout payments are processed by Stripe. By using Secure Checkout you agree to Stripe's Privacy Policy and Terms of Service. PhillyGrind shares transaction data with Stripe solely for payment processing and fraud prevention purposes.</p>

        <h2>9. Marketplace Photos</h2>
        <p>Photos uploaded to the Marketplace are stored in a public Supabase Storage bucket and are viewable by anyone visiting the listing. Do not upload photos containing sensitive personal information.</p>

        <h2>10. CCPA Compliance</h2>
        <p>California residents have the right to request access to, deletion of, or opt-out of the sale of their personal data. Pennsylvania residents and other US users may also request data access or deletion by contacting us at drewnegron95@gmail.com.</p>

        <h2>11. DMCA Policy</h2>
        <p>If you believe content on PhillyGrind infringes your copyright, please send a DMCA takedown notice to drewnegron95@gmail.com with a description of the copyrighted work, the URL of the infringing content, and your contact information. We will respond within 72 hours.</p>

        <h2>12. Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. When we do, we will update the Last Updated date. Continued use of PhillyGrind after changes are posted constitutes acceptance of the updated policy.</p>

        <h2>13. Contact</h2>
        <p>For questions about this Privacy Policy, contact us at support@phillygrind.work.</p>
      </article>
    </section>
  );
}

export default Privacy;
