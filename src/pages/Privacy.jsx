function Privacy() {
  return (
    <section className="legal-page">
      <div className="page-heading">
        <span className="eyebrow">Privacy</span>
        <h1>Privacy Policy</h1>
        <p>Last Updated: August 13, 2026</p>
      </div>

      <article className="legal-card">
        <p>This Privacy Policy explains how PhillyGrind ("PhillyGrind," "we," "us," or "our") collects, uses, and protects information when you use phillygrind.work (the "Platform").</p>

        <h2>1. Information We Collect</h2>

        <h3>1.1 Information You Provide</h3>
        <ul>
          <li><strong>Account information:</strong> name, email address, password (hashed), profile photo</li>
          <li><strong>Listing content:</strong> job postings, gig postings, marketplace listings, housing listings, community posts, comments, and reactions</li>
          <li><strong>Verification documents:</strong> identity or business documentation submitted for landlord or user verification badges</li>
          <li><strong>Payment information:</strong> processed and stored by our payment processor, Stripe — PhillyGrind does not store full payment card numbers</li>
          <li><strong>Messages:</strong> content sent through PhillyGrind's in-platform messaging and GrindBot chatbot</li>
          <li><strong>Communications with us:</strong> support requests, dispute submissions, and evidence submitted during a dispute</li>
        </ul>

        <h3>1.2 Information Collected Automatically</h3>
        <ul>
          <li>Device and browser information</li>
          <li>IP address</li>
          <li>Usage data (pages viewed, features used, general activity on the Platform)</li>
          <li>Cookies and similar technologies (see Section 6)</li>
        </ul>

        <h2>2. How We Use Information</h2>
        <p>We use collected information to:</p>
        <ul>
          <li>Operate and maintain the Platform (accounts, listings, messaging, payments)</li>
          <li>Process Marketplace transactions and Secure Checkout escrow through Stripe</li>
          <li>Screen content through our moderation systems (Section 3)</li>
          <li>Verify landlord and user identity for verification badges</li>
          <li>Investigate and resolve disputes between users</li>
          <li>Communicate with you about your account, transactions, or support requests</li>
          <li>Improve and maintain Platform security</li>
          <li>Comply with legal obligations</li>
        </ul>

        <h2>3. AI-Assisted Content Moderation</h2>
        <p>PhillyGrind uses automated systems, including third-party AI providers (OpenAI and/or Groq), to screen user-submitted content — including Housing, Marketplace, Jobs, Gigs, and Community posts — for compliance with our Terms of Service, including Fair Housing law compliance, scam pattern detection, and harassment/doxxing detection.</p>
        <ul>
          <li>Content submitted for a listing or post is sent to our AI moderation service (which may include a third-party AI provider) for automated analysis.</li>
          <li>If a violation is flagged, the flagged content, the specific phrases identified, and the rule violated are logged internally for administrative review.</li>
          <li>We do not use content submitted for moderation to train third-party AI models, to the extent controllable by our provider agreements.</li>
          <li>Moderation decisions may be reviewed and, where appropriate, appealed by contacting [support email].</li>
        </ul>

        <h2>4. How We Share Information</h2>
        <p>We do not sell your personal information. We share information only as follows:</p>
        <ul>
          <li><strong>With other users:</strong> your display name, profile photo, and any content you choose to post are visible to other users as part of normal Platform functionality (e.g., a job listing, a marketplace listing, or a community post).</li>
          <li><strong>With service providers:</strong> Stripe (payments), Supabase (database/hosting infrastructure), Vercel (application hosting), OpenAI and/or Groq (AI content moderation), Resend (transactional email), and other vendors who process data on our behalf under confidentiality obligations.</li>
          <li><strong>For legal reasons:</strong> if required by law, subpoena, or legal process, or to protect the rights, property, or safety of PhillyGrind, our users, or the public.</li>
          <li><strong>In a business transfer:</strong> if PhillyGrind is involved in a merger, acquisition, or sale of assets, user information may be transferred as part of that transaction, subject to this Policy.</li>
        </ul>
        <p><strong>Email addresses are never displayed publicly on the Platform.</strong></p>

        <h2>5. Data Retention</h2>
        <p>We retain account and listing information for as long as your account is active. Moderation logs (including flagged content and the outcome of the moderation check) are retained to support dispute resolution, legal compliance, and pattern detection, even after the associated listing is removed or the account is closed, for a period we determine is reasonably necessary.</p>

        <h2>6. Cookies</h2>
        <p>We use cookies and similar technologies to keep you logged in, remember your preferences (e.g., dark mode, neighborhood filter), and understand how the Platform is used. You can control cookies through your browser settings, though disabling cookies may affect Platform functionality.</p>

        <h2>7. Your Rights and Choices</h2>
        <p>Depending on your location, you may have the right to:</p>
        <ul>
          <li>Access the personal information we hold about you</li>
          <li>Request correction of inaccurate information</li>
          <li>Request deletion of your account and associated personal information</li>
          <li>Object to or restrict certain processing of your information</li>
        </ul>
        <p>To exercise these rights, contact us at [support email]. We will respond within a reasonable time and in accordance with applicable law, including the Pennsylvania and any applicable state privacy frameworks.</p>

        <h2>8. Children's Privacy</h2>
        <p>PhillyGrind is not intended for use by anyone under 18. We do not knowingly collect personal information from anyone under 18. If we learn that we have done so, we will delete that information.</p>

        <h2>9. Data Security</h2>
        <p>We use reasonable administrative, technical, and physical safeguards to protect your information, including encrypted data storage and transmission (via Supabase and Stripe) and role-based access controls for administrative data (including moderation logs). No system is completely secure, and we cannot guarantee absolute security.</p>

        <h2>10. Data Location</h2>
        <p>Your information is processed and stored using infrastructure providers (Supabase, Vercel, Stripe) that may store data outside of your state or country of residence.</p>

        <h2>11. Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. Material changes will be reflected by updating the "Last Updated" date above, and, where appropriate, additional notice will be provided.</p>

        <h2>12. Contact Us</h2>
        <p>Questions about this Privacy Policy or your information can be sent to [support email].</p>

        <p className="legal-disclaimer"><em>This document is a working draft. PhillyGrind recommends review by a licensed attorney before this document is treated as final, particularly regarding data handling obligations tied to payment processing, housing verification documents, and AI-assisted moderation.</em></p>
      </article>
    </section>
  );
}

export default Privacy;
