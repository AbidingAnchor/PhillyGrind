import { Link } from 'react-router-dom';

function Terms() {
  return (
    <section className="legal-page">
      <div className="page-heading">
        <span className="eyebrow">Legal</span>
        <h1>Terms of Service</h1>
        <p>Last Updated: August 13, 2026</p>
      </div>

      <article className="legal-card">
        <p>Welcome to PhillyGrind ("PhillyGrind," "we," "us," or "our"), a Philadelphia-focused community platform offering job listings, gig postings, a marketplace, housing listings, and a community social feed, accessible at phillygrind.work (the "Platform" or "Service").</p>
        <p>By creating an account or using PhillyGrind, you agree to these Terms of Service ("Terms"). If you do not agree, do not use the Platform.</p>

        <h2>1. Eligibility</h2>
        <p>You must be at least 18 years old to create an account or use PhillyGrind. By using the Platform, you represent that you meet this requirement and that all information you provide is accurate and current.</p>

        <h2>2. Account Registration</h2>
        <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. Notify us immediately through our <Link to="/contact">Contact page</Link> if you suspect unauthorized use of your account.</p>
        <p>You agree not to:</p>
        <ul>
          <li>Create an account using false information</li>
          <li>Create multiple accounts to evade a suspension or ban</li>
          <li>Impersonate another person or entity</li>
        </ul>

        <h2>3. Platform Role and Relationship of Parties</h2>
        <p>PhillyGrind is a <strong>platform that connects users</strong> — it is not a party to any transaction, employment relationship, rental agreement, or sale between users. We do not:</p>
        <ul>
          <li>Employ any worker who posts or responds to Job or Gig listings</li>
          <li>Act as a landlord, property manager, or party to any lease</li>
          <li>Own, inspect, or guarantee any item sold through Marketplace</li>
          <li>Guarantee the accuracy of any listing, profile, or user-submitted content</li>
        </ul>
        <p>Users are solely responsible for their own conduct, the accuracy of what they post, and their compliance with applicable law in any transaction or interaction facilitated through PhillyGrind.</p>

        <h2>4. Community Feed</h2>
        <p>The Community feed allows users to post, comment on, and react to content related to Philadelphia neighborhoods.</p>
        <p><strong>You agree not to post content that:</strong></p>
        <ul>
          <li>Is discriminatory, harassing, threatening, or promotes violence against any individual or group</li>
          <li>Discloses another person's private information without their consent ("doxxing"), including home address, phone number, or other identifying details</li>
          <li>Is false and materially misleading (misinformation)</li>
          <li>Infringes on another person's intellectual property rights</li>
          <li>Is spam, unauthorized advertising, or promotes a competing platform</li>
          <li>Violates any applicable law</li>
        </ul>
        <p>We use a combination of automated moderation (including AI-based content review) and human review to enforce this section. See Section 9 (Content Moderation) below.</p>

        <h2>5. Jobs and Gigs</h2>
        <p>Job and Gig listings are posted by users seeking to hire or be hired. PhillyGrind does not verify the legitimacy of any employer, job, or gig listing, though we apply automated screening (Section 9) to detect common scam patterns and discriminatory hiring language.</p>
        <p><strong>Prohibited in Job/Gig postings:</strong></p>
        <ul>
          <li>Discriminatory hiring criteria based on race, color, religion, sex, age, disability, national origin, sexual orientation, or gender identity, except where a bona fide occupational qualification applies and is disclosed as such</li>
          <li>Requests for payment from a prospective worker as a condition of being hired</li>
          <li>Multi-level marketing (MLM) or pyramid-scheme recruitment disguised as a job or gig posting</li>
          <li>Unpaid labor misrepresented as a paid position</li>
        </ul>
        <p>Users engaging in Jobs/Gigs transactions are responsible for verifying the legitimacy of the other party and for complying with applicable employment and labor law.</p>

        <h2>6. Marketplace</h2>
        <p>Marketplace allows users to buy and sell goods locally, with an optional Secure Checkout feature.</p>

        <h3>6.1 Secure Checkout / Escrow</h3>
        <p>When a buyer uses Secure Checkout, PhillyGrind (via our payment processor, Stripe) holds payment in escrow until:</p>
        <ul>
          <li>The buyer confirms receipt of the item ("I Received This Item"), or</li>
          <li>The auto-release period elapses following the seller's confirmed handoff, or</li>
          <li>A dispute is resolved through our dispute process (Section 6.3)</li>
        </ul>
        <p>An 8% platform fee applies to transactions completed through Secure Checkout, paid by the buyer.</p>

        <h3>6.2 Prohibited Items</h3>
        <p>Users may not list or sell:</p>
        <ul>
          <li>Weapons, ammunition, or explosives</li>
          <li>Illegal drugs or drug paraphernalia</li>
          <li>Stolen, counterfeit, or recalled goods</li>
          <li>Any item prohibited by federal, Pennsylvania, or Philadelphia law</li>
        </ul>
        <p>We apply automated screening to detect these patterns; violating listings are removed and may result in account suspension.</p>

        <h3>6.3 Disputes</h3>
        <p>If a buyer and seller disagree about whether an item was received, matches its description, or was handled properly, either party may open a dispute. Both parties may submit evidence; PhillyGrind reviews the evidence and makes a final determination regarding release of escrowed funds. Our decision on fund release is final.</p>

        <h3>6.4 Cash Transactions</h3>
        <p>Users may also arrange cash transactions outside of Secure Checkout. PhillyGrind has no visibility into and bears no responsibility for cash transactions arranged between users.</p>

        <h2>7. Housing</h2>
        <p>The Housing section allows users to list and browse rental housing in Philadelphia.</p>

        <h3>7.1 Fair Housing Compliance</h3>
        <p>All Housing listings must comply with the federal Fair Housing Act and applicable Pennsylvania and Philadelphia fair housing law. Listings may not express a preference, limitation, or discrimination based on:</p>
        <ul>
          <li>Race, color, religion, sex, national origin, familial status, or disability (protected under federal law)</li>
          <li>Sexual orientation, gender identity, or source of income, including Section 8 housing vouchers (protected under Philadelphia and/or Pennsylvania law)</li>
        </ul>
        <p>We apply automated AI screening to Housing listings to detect potentially discriminatory language before a listing is published. Listings flagged with high confidence are automatically rejected; listings flagged with lower confidence are published but routed to human review. <strong>This automated screening is a compliance aid, not a legal guarantee — listing owners remain fully responsible for ensuring their listings comply with Fair Housing law.</strong></p>

        <h3>7.2 Landlord Verification</h3>
        <p>Landlords may submit identifying documentation to receive a "Verified" badge. Verification indicates only that the landlord submitted the requested documentation to PhillyGrind — it is not a guarantee of the landlord's conduct, the accuracy of a listing, or the condition of a property.</p>

        <h3>7.3 Reporting</h3>
        <p>Users may report Housing listings they believe are inaccurate, fraudulent, or discriminatory. Listings that accumulate multiple reports are automatically flagged for review and may display a warning to prospective renters pending review.</p>

        <h2>8. Verification Badges</h2>
        <p>PhillyGrind may issue a blue verification badge to users or landlords who have submitted identity or business documentation and been approved. A verification badge indicates that a user completed our verification process — it does not guarantee the user's future conduct, and PhillyGrind is not liable for the actions of a verified user.</p>

        <h2>9. Content Moderation</h2>
        <p>PhillyGrind uses a combination of:</p>
        <ul>
          <li><strong>Third-party moderation APIs</strong> (e.g., OpenAI's Moderation API) to screen content for broadly unsafe categories (e.g., sexual content, violence, hate speech, self-harm)</li>
          <li><strong>Custom AI-based rule checks</strong>, built and maintained by PhillyGrind, that screen content against platform-specific rules (Fair Housing compliance, marketplace scam patterns, discriminatory hiring language, harassment, and doxxing)</li>
          <li><strong>Human admin review</strong> of flagged content</li>
        </ul>
        <p>Content that receives a high-confidence violation determination may be automatically rejected before it is published. Content flagged with lower confidence is logged for human review and may remain visible pending that review.</p>
        <p><strong>Limitations:</strong> Automated moderation is a tool to reduce risk, not a guarantee that all violating content will be caught or that no compliant content will be mistakenly flagged. Users may appeal a moderation decision by contacting us through our <Link to="/contact">Contact page</Link>.</p>

        <h2>10. Prohibited Conduct (Platform-Wide)</h2>
        <p>In addition to category-specific rules above, users may not:</p>
        <ul>
          <li>Use the Platform for any unlawful purpose</li>
          <li>Harass, threaten, or abuse other users</li>
          <li>Attempt to circumvent Secure Checkout to defraud another user</li>
          <li>Scrape, reverse-engineer, or misuse the Platform's data or infrastructure</li>
          <li>Attempt to bypass or interfere with our moderation systems</li>
        </ul>

        <h2>11. Account Suspension and Termination</h2>
        <p>We may suspend or terminate any account that violates these Terms, at our discretion. Users may also request deletion of their own account at any time (see Privacy Policy for data deletion).</p>

        <h2>12. Disclaimers</h2>
        <p>THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. PHILLYGRIND DOES NOT GUARANTEE THE ACCURACY, LEGALITY, OR SAFETY OF LISTINGS, USER CONTENT, OR TRANSACTIONS. YOU USE THE PLATFORM AND ENGAGE IN ANY TRANSACTION AT YOUR OWN RISK.</p>

        <h2>13. Limitation of Liability</h2>
        <p>TO THE FULLEST EXTENT PERMITTED BY LAW, PHILLYGRIND AND ITS OPERATORS ARE NOT LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE PLATFORM, INCLUDING DAMAGES ARISING FROM TRANSACTIONS, DISPUTES, OR CONTENT MODERATION DECISIONS.</p>

        <h2>14. Changes to These Terms</h2>
        <p>We may update these Terms from time to time. Continued use of the Platform after changes take effect constitutes acceptance of the updated Terms.</p>

        <h2>15. Governing Law</h2>
        <p>These Terms are governed by the laws of the Commonwealth of Pennsylvania, without regard to conflict-of-law principles.</p>

        <h2>16. Contact</h2>
        <p>Questions about these Terms can be sent through our <Link to="/contact">Contact page</Link>.</p>

        <p className="legal-disclaimer"><em>This document is a working draft. PhillyGrind recommends review by a licensed attorney familiar with Pennsylvania and Philadelphia law before this document is treated as final, particularly given the Platform's handling of escrow payments, housing listings, and automated content moderation.</em></p>
      </article>
    </section>
  );
}

export default Terms;
