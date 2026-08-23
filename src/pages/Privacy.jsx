import { Link } from 'react-router-dom';

function Privacy() {
  return (
    <section className="legal-page">
      <div className="page-heading">
        <span className="eyebrow">Privacy</span>
        <h1>Privacy Policy</h1>
        <p>Last Updated: August 23, 2026</p>
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

        <h3>1.3 Weather and Local Alerts</h3>
        <p>To show you local weather conditions and severe weather alerts relevant to your neighborhood, we use your selected neighborhood (or, where available, your approximate location) to request data from the National Weather Service (NWS), a public U.S. government data source. We do not share your precise location or account information with NWS — only the general area needed to retrieve relevant weather data.</p>

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
          <li>Moderation decisions may be reviewed and, where appropriate, appealed by contacting us through our <Link to="/contact">Contact page</Link>.</li>
        </ul>

        <h3>3.1 GrindBot Account Assistance</h3>
        <p>When you chat with GrindBot, it may access your own account information — including your recent listings, orders, bids, and report or support ticket history — to answer your questions and help troubleshoot issues. GrindBot can only access information tied to your own logged-in account; it cannot view or retrieve another user's information, regardless of how a request is phrased. GrindBot may also file a support ticket on your behalf after confirming with you that you'd like it to do so.</p>

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
        <p>To exercise these rights, contact us through our <Link to="/contact">Contact page</Link>. We will respond within a reasonable time and in accordance with applicable law, including the Pennsylvania and any applicable state privacy frameworks.</p>

        <h3>7.1 Account Recovery</h3>
        <p>If you lose access to the email address associated with your account, you may request account recovery. To verify your identity, we'll ask you to answer a small number of questions about your account (such as approximately when you joined, your selected neighborhood, or a recent post). Your answers are compared by a human reviewer against information already on file for that account — including a snapshot of your account activity taken at the time of your request. We do not tell you which answers matched or didn't, to protect against attempts to guess your account information. If approved, we will email a one-time secure link to the new email address you provide, allowing you to set a new password. Approving a recovery request also disables two-factor authentication on the account (since it may be tied to the lost inbox) and signs out all active sessions for security. Recovery requests, snapshots, and the IP address they were submitted from are retained to prevent abuse of this process.</p>

        <h2>8. Children's Privacy</h2>
        <p>PhillyGrind is intended for use by individuals 18 years of age and older. We do not knowingly collect personal information from children under the age of 13, and our services are not directed to children.</p>
        <p>At signup, we ask for your date of birth to confirm you meet our minimum age requirement. This information is used solely to verify your age and is not retained after that verification is complete.</p>
        <p>If we learn that we have collected personal information from a user under the age of 13, we will:</p>
        <ul>
          <li>Deactivate the associated account,</li>
          <li>Delete the personal information we have collected from that user, and</li>
          <li>Not use or disclose that information for any purpose in the interim.</li>
        </ul>
        <p>If you believe a child under 13 has provided us with personal information, please contact us at support@phillygrind.work so we can investigate and take appropriate action.</p>
        <p>This policy is in addition to, and does not replace, our general age requirement that all users be 18 or older to use PhillyGrind.</p>

        <h2>9. Data Security</h2>
        <p>We use reasonable administrative, technical, and physical safeguards to protect your information, including encrypted data storage and transmission (via Supabase and Stripe) and role-based access controls for administrative data (including moderation logs). No system is completely secure, and we cannot guarantee absolute security.</p>

        <h2>10. Data Location</h2>
        <p>Your information is processed and stored using infrastructure providers (Supabase, Vercel, Stripe) that may store data outside of your state or country of residence.</p>

        <h2>11. Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. Material changes will be reflected by updating the "Last Updated" date above, and, where appropriate, additional notice will be provided.</p>

        <h2>12. Contact Us</h2>
        <p>Questions about this Privacy Policy or your information can be sent through our <Link to="/contact">Contact page</Link>.</p>

        <p className="legal-disclaimer"><em>This document is a working draft. PhillyGrind recommends review by a licensed attorney before this document is treated as final, particularly regarding data handling obligations tied to payment processing, housing verification documents, and AI-assisted moderation.</em></p>
      </article>
    </section>
  );
}

export default Privacy;
