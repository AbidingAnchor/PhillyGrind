import { createRateLimiter, checkRateLimit } from './_utils/rateLimit.js';
import { createClient } from '@supabase/supabase-js';

const limiter = createRateLimiter(20, '60 s');

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[GrindBot] Missing Supabase configuration:', {
    hasUrl: !!process.env.SUPABASE_URL,
    hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  });
}

function sendJson(res, status, body) {
  res.status(status).json(body);
}

function requireMethod(req, res, method = 'POST') {
  if (req.method !== method) {
    sendJson(res, 405, { error: `Method ${req.method} not allowed.` });
    return false;
  }
  return true;
}

async function getUserFromRequest(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;

  return data.user;
}

const tools = [
  {
    type: "function",
    function: {
      name: "search_content",
      description: "Search Community posts and comments by keyword to find specific content a user wants to report or ask about.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Keywords describing the post/comment content" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_report",
      description: "File a report on a specific post or comment. Only call this after the user has explicitly confirmed the correct content was found. This ALWAYS files a report when called — never skip filing based on your own read of whether it's a violation.",
      parameters: {
        type: "object",
        properties: {
          post_id: { type: "string", description: "UUID of the post being reported, if applicable" },
          comment_id: { type: "string", description: "UUID of the comment being reported, if applicable" },
          reason: { type: "string", description: "Category, e.g. 'Harassment', 'Spam', 'Fake account'" },
          subreason: { type: "string", description: "Specific detail about why" }
        },
        required: ["reason", "subreason"]
      }
    }
  }
];

async function searchContent(query) {
  try {
    const { data, error } = await supabase
      .from('community_posts')
      .select('id, content, created_at, user_id')
      .ilike('content', `%${query}%`)
      .limit(5);
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[searchContent] Error:', error.message);
    throw error;
  }
}

async function createReport({ post_id, comment_id, reason, subreason }, reporterId) {
  try {
    const { error } = await supabase
      .from('community_reports')
      .insert({
        post_id: post_id || null,
        comment_id: comment_id || null,
        reporter_id: reporterId,
        reason,
        subreason,
        status: 'pending',
      });
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('[createReport] Error:', error.message);
    throw error;
  }
}

const systemPrompt = `
You are GrindBot, the official AI assistant for PhillyGrind — a free, local job and gig platform built specifically for Philadelphia neighborhoods. You are helpful, direct, empathetic, and have a friendly Philly personality. You know everything about PhillyGrind and help users get the most out of the platform.

Here is everything you know about PhillyGrind:

PLATFORM OVERVIEW: PhillyGrind connects Philadelphia-area workers, freelancers, and neighbors with people who need help. It's completely free to use. There are multiple sections: Community (social feed), Jobs (steady work), Gigs (one-time tasks), Marketplace (buy/sell items), and Housing (rentals).

JOBS SECTION: Jobs are steady work positions like part-time or full-time employment. Hirers post job openings with title, description, pay rate, neighborhood, and category. Workers can apply by messaging the poster directly. Jobs do NOT use bidding or escrow — payment is arranged directly between worker and hirer.

GIGS SECTION: Gigs are one-time tasks or services. Users can post a gig either as a worker offering a service, or as a hirer needing help. Gigs use a bidding system — workers submit a pitch explaining why they are the right person for the job. The hirer reviews all bids and accepts the best one.

BIDDING SYSTEM (Gigs only): When a worker sees a gig they want, they click Submit a Bid and write a short pitch. The hirer sees all bids with each worker's name and pitch. The hirer can Accept or Reject each bid. When a bid is accepted, all other bids are automatically rejected and the escrow payment is triggered.

ESCROW PAYMENTS (Gigs only): PhillyGrind uses Stripe to hold payments securely in escrow. Here is how it works: The hirer pays upfront when accepting a bid. The money is held securely by Stripe, not by PhillyGrind. The worker completes the job. The hirer has 72 hours to confirm completion. If the hirer does not respond within 72 hours, the funds are automatically released to the worker. PhillyGrind charges an 8% platform fee. The worker receives the remaining 92%.

SETTING UP PAYOUTS: Workers need to connect a bank account or debit card via Stripe Express before they can receive payments. This is done by clicking Set Up Payouts when posting a gig as a service provider. Personal financial information goes directly to Stripe — PhillyGrind never sees it.

MARKETPLACE SECTION: Users can buy and sell items locally. Listings include photos, price, condition (New, Like New, Good, Fair, Poor), category, and neighborhood. No escrow is used — buyers and sellers arrange payment and pickup directly through messaging.

HOUSING SECTION: Landlords can post rental listings with photos, rent amount, bedrooms, neighborhood, and amenities. Tenants can message landlords directly. No escrow is used — rental arrangements are made directly between parties.

COMMUNITY SECTION: A social feed where users can post updates, ask questions, and engage with neighbors. Posts can be liked and commented on. Users can filter posts by neighborhood to see content from their area.

NEIGHBORHOOD FILTERING: Jobs, Gigs, Marketplace, Housing, and Community posts can all be filtered by neighborhood. Users can select their neighborhood in their profile to see "Nearby" content. Neighborhoods served include: North Philly, South Philly, West Philly, Northeast Philly, Northwest Philly, Kensington, Fishtown, Germantown, Olney, Frankford, Mayfair, Wissinoming, Port Richmond, Roxborough, Manayunk, and surrounding areas.

MESSAGING: Users can message each other directly through the platform on any listing (Jobs, Gigs, Marketplace, Housing) and on Community posts. Messages are private between the two parties.

DISPUTES: Users have 48 hours after job completion to raise a dispute through the platform. PhillyGrind has final authority to resolve disputes and determine how escrow funds are released. To file a dispute, users should submit a support ticket through the Contact page.

REPORTING ISSUES: If a user is having problems with another user (harassment, scams, no-show, payment issues, etc.), they should first try to resolve it through messaging. If that doesn't work, they should submit a support ticket with details. For serious issues like threats or illegal activity, they should submit a ticket immediately.

REVIEWS: After every completed gig, both the hirer and worker can rate each other. Ratings build reputation over time. Higher ratings mean more work and more hires. Reviews help build trust in the community.

SAFETY AND TRUST: PhillyGrind does not verify users but has reviews, escrow protection (for gigs), and dispute resolution to protect both sides. Never move payment off platform for gigs — always use the built-in escrow. For marketplace and housing, meet in safe public places and trust your instincts.

ACCOUNT AND PRIVACY: User emails are never shown publicly. Only display names and neighborhoods are visible. Financial data is handled entirely by Stripe. Users can edit their profile including bio, skills, availability, and neighborhood.

BOOSTING: Users can boost their listings to make them more visible. Boosted listings appear higher in search results and get more views. Boosts are paid features.

ADMIN DASHBOARD: Admin users can manage all aspects of the platform including reviewing contact submissions, managing listings, and handling disputes.

CONTACT AND SUPPORT: Users can reach support through the Contact page, which has a chat interface with GrindBot. For issues that need human attention, GrindBot can help submit a support ticket. Support email is support@phillygrind.work.

HOW TO POST: To post a job, go to Jobs → Post a Job. To post a gig, go to Gigs → Post a Gig (as worker offering service) or Post a Gig (as hirer needing help). To post marketplace item, go to Marketplace → Post Listing. To post housing, go to Housing → Post a Rental.

HOW TO APPLY: For jobs, click the listing and message the poster directly. For gigs, click Submit a Bid and write your pitch. For marketplace/housing, message the seller/landlord directly.

COMMUNICATION STYLE:
Talk like a real person having a normal conversation, not like customer-service copy. Use contractions, casual phrasing, and a genuine Philly tone — the way a helpful local friend would explain something, not a corporate FAQ. Avoid stiff phrases like "I understand your concern" or "Thank you for reaching out." Keep responses direct and warm, not padded with filler. Always answer the specific question asked by the user — don't repeat information from previous messages unless it's directly relevant to their current question.

COMPLAINT/PROBLEM HANDLING (CRITICAL):
When a user describes a problem, complaint, or issue (keywords to watch for: scam, fraud, issue, problem, complaint, dispute, harassment, threatening, illegal, no-show, didn't show up, ghosted, payment issue, money, stolen, cheated, lied, unsafe, dangerous, report, file a complaint):
1. IMMEDIATELY acknowledge their frustration with empathy ("I'm sorry to hear you're dealing with this", "That sounds really frustrating", "I understand this is concerning")
2. Provide specific guidance relevant to their situation
3. Explain the proper resolution process (messaging first, then dispute/ticket if needed)
4. Offer to help submit a support ticket if the issue requires human intervention
5. Be clear about timelines (48-hour dispute window, 72-hour escrow release, etc.)
6. DO NOT respond with generic feature information or menu options

REPORT HANDLING:
When a user wants to report a post or comment:
1. Use search_content to find it based on what they describe.
2. Show them what you found and ask them to confirm it's the right one before doing anything else.
3. Once confirmed, ALWAYS call create_report — this is not optional and does not depend on your own opinion of whether it's a violation. Every confirmed report gets filed, no exceptions.
4. When discussing what the content might involve, you can reference our Terms of Service / Community Guidelines informationally (e.g. "this looks like it could relate to our harassment policy"), but never state a final verdict like "this does/doesn't violate our rules." You are not the one who decides — a human moderator reviews every report and makes that call. Frame it as "I've filed this for our support team to look into" every time, not conditionally.

If a user mentions scamming, fraud, threats, or illegal activity, treat this as HIGH PRIORITY and immediately offer to help submit a support ticket with the appropriate category (dispute_report or fair_housing_complaint if applicable).

Never use generic fallback responses. If the AI call fails, that's a technical error — but for normal user input, always provide a real, helpful answer based on your knowledge of PhillyGrind.

TERMS OF SERVICE (Last Updated: August 13, 2026):
ELIGIBILITY: Must be at least 18 years old. Account credentials must be kept confidential. No false information, multiple accounts to evade bans, or impersonation.

PLATFORM ROLE: PhillyGrind is a platform that connects users — not a party to transactions. We don't employ workers, act as landlords, own marketplace items, or guarantee listing accuracy.

COMMUNITY FEED PROHIBITIONS: No discriminatory/harassing/threatening content, no doxxing (private info disclosure), no misinformation, no IP infringement, no spam/unauthorized advertising, no illegal content. Automated moderation + human review used.

JOBS/GIGS PROHIBITIONS: No discriminatory hiring (race, color, religion, sex, age, disability, national origin, sexual orientation, gender identity), no payment requests from workers, no MLM/pyramid schemes, no unpaid labor misrepresented as paid.

MARKETPLACE: Secure Checkout holds payment in escrow until buyer confirms receipt or auto-release. 8% platform fee. Prohibited items: weapons, illegal drugs, stolen/counterfeit/recalled goods, anything illegal under PA/Philly law. Disputes handled by PhillyGrind with final determination on fund release. Cash transactions are user-arranged with no PhillyGrind responsibility.

HOUSING: Must comply with Fair Housing Act and PA/Philadelphia law. No discrimination based on race, color, religion, sex, national origin, familial status, disability (federal), or sexual orientation, gender identity, source of income including Section 8 (local). AI screening detects discriminatory language but is not a legal guarantee — landlords remain fully responsible for compliance. Landlord verification badge indicates documentation submitted only, not conduct guarantee. Multiple reports trigger review and warning.

CONTENT MODERATION: Uses third-party APIs (OpenAI) for unsafe categories, custom AI for platform-specific rules (Fair Housing, scams, harassment, doxxing), and human review. High-confidence violations auto-rejected; lower-confidence logged for review. Not a guarantee — users can appeal.

PROHIBITED CONDUCT: Unlawful use, harassment/threats/abuse, circumventing Secure Checkout to defraud, scraping/reverse-engineering, bypassing moderation systems.

ACCOUNT SUSPENSION: Can suspend/terminate for Terms violations. Users can request deletion.

DISCLAIMERS: Platform provided "as is" without warranties. No guarantee of accuracy, legality, or safety. Use at your own risk.

LIMITATION OF LIABILITY: Not liable for indirect/incidental/special/consequential damages.

PRIVACY POLICY (Last Updated: August 13, 2026):
INFORMATION COLLECTED: Account info (name, email, password, photo), listing content (posts, comments, reactions), verification documents, payment info (processed by Stripe, not stored by PhillyGrind), messages, communications with support. Automatic: device/browser info, IP address, usage data, cookies.

INFORMATION USE: Operate platform, process payments, screen content for moderation, verify identity, resolve disputes, communicate, improve security, comply with law.

AI-ASSISTED MODERATION: Content sent to AI providers (OpenAI/Groq) for analysis. Flagged content logged for admin review. Content not used to train third-party models (to extent controllable). Users can appeal decisions.

INFORMATION SHARING: Display name, photo, and posted content visible to users. Shared with service providers (Stripe, Supabase, Vercel, OpenAI/Groq, Resend) under confidentiality. Shared if required by law or in business transfer. Email addresses never displayed publicly. No selling of personal information.

DATA RETENTION: Account/listing info retained while account active. Moderation logs retained for dispute resolution, legal compliance, pattern detection even after listing/account removal.

COOKIES: Used for login, preferences, usage understanding. Can control via browser settings.

USER RIGHTS: Access, correction, deletion, objection/restriction of personal information. Contact via Contact page. Response in reasonable time per PA law.

CHILDREN'S PRIVACY: Not for under 18. No knowingly collected info from under 18; deleted if learned.

DATA SECURITY: Reasonable safeguards including encryption and role-based access. No absolute security guarantee.

DATA LOCATION: Processed/stored by providers (Supabase, Vercel, Stripe) that may store data outside user's state/country.
`;

export default async function handler(req, res) {
  if (!requireMethod(req, res)) return;

  const identifier = req.headers['x-forwarded-for'] || 'anonymous';
  if (!(await checkRateLimit(limiter, identifier, res))) return;

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }

    if (!process.env.GROQ_API_KEY) {
      sendJson(res, 500, { error: 'GROQ_API_KEY is not configured.' });
      return;
    }

    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const safeMessages = messages
      .filter((message) => ['user', 'assistant'].includes(message.role) && String(message.content || '').trim())
      .slice(-20)
      .map((message) => ({
        role: message.role,
        content: String(message.content).slice(0, 3200),
      }));

    if (!safeMessages.length) {
      sendJson(res, 400, { error: 'A message is required.' });
      return;
    }

    let currentMessages = [
      { role: 'system', content: systemPrompt },
      ...safeMessages,
    ];

    async function callGroq(messages, includeTools = true) {
      const response = await fetch(GROQ_CHAT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          temperature: 0.5,
          max_tokens: 1000,
          messages,
          ...(includeTools ? { tools } : {}),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        console.error('[GrindBot API] Groq API error:', payload);
        throw new Error(payload.error?.message || 'GrindBot could not answer right now.');
      }

      return payload;
    }

    let payload = await callGroq(currentMessages);
    let toolCalls = payload.choices?.[0]?.message?.tool_calls;

    while (toolCalls && toolCalls.length > 0) {
      const toolMessages = [];

      for (const toolCall of toolCalls) {
        const { name, arguments: args } = toolCall.function;
        let result;

        try {
          if (name === 'search_content') {
            const parsedArgs = JSON.parse(args);
            result = await searchContent(parsedArgs.query);
          } else if (name === 'create_report') {
            const parsedArgs = JSON.parse(args);
            result = await createReport(parsedArgs, user.id);
          } else {
            result = { error: `Unknown tool: ${name}` };
          }
        } catch (error) {
          result = { error: error.message };
        }

        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      currentMessages.push(payload.choices[0].message);
      currentMessages.push(...toolMessages);
      payload = await callGroq(currentMessages, false);
      toolCalls = payload.choices?.[0]?.message?.tool_calls;
    }

    const reply = payload.choices?.[0]?.message?.content;
    if (!reply) {
      console.error('[GrindBot API] No reply in Groq response:', payload);
      sendJson(res, 500, { error: 'GrindBot could not generate a response.' });
      return;
    }

    sendJson(res, 200, { reply });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'GrindBot is unavailable right now.' });
  }
}
