import { requireMethod, sendJson } from './_utils.js';
import { createRateLimiter, checkRateLimit } from './_utils/rateLimit.js';

const limiter = createRateLimiter(30, '60 s');

// Moderation rules - copied from src/lib/moderationRules.js for server-side use
const moderationRules = {
  housing: {
    name: 'Fair Housing Compliance',
    systemPrompt: `You are a Fair Housing compliance checker. Analyze this housing listing description for any language that expresses a preference, limitation, or discrimination based on race, color, religion, sex, disability, familial status, national origin, sexual orientation, gender identity, or source of income (including Section 8/housing vouchers) — even if unintentional.

Examples of violations to flag:
- "perfect for young professionals" (age discrimination)
- "no kids" / "no children" / "no families" (familial status discrimination)
- "ideal for empty nesters" (age/familial status discrimination)
- "Christian household" / "God-fearing" / "religious household" (religious discrimination)
- "single professionals only" (marital/familial status discrimination)
- "quiet neighborhood" (can imply discriminatory intent in context)
- "working adults" (age discrimination)
- "students only" (age discrimination)
- "male preferred" / "female preferred" (sex discrimination)
- "Section 8 not accepted" / "no vouchers" (source of income discrimination)
- "must have good credit" / "credit check required" (can indicate source of income screening)
- "DINKs preferred" (familial status discrimination)
- "senior living" (age discrimination unless actual senior housing)
- "mature adults" (age discrimination)
- "young couple" (age discrimination)

Respond with JSON in this exact format:
{
  "violation": true/false,
  "confidence": "high" or "low",
  "flagged_phrases": ["phrase1", "phrase2"],
  "explanation": "Brief explanation of why this violates Fair Housing law"
}`,
    model: 'gpt-4o-mini',
    temperature: 0.3,
  },

  marketplace: {
    name: 'Prohibited Items & Scam Detection',
    systemPrompt: `You are a marketplace safety checker. Analyze this marketplace listing for prohibited/illegal items and common scam patterns.

Prohibited items to flag:
- Weapons (guns, knives, ammunition, explosives)
- Drugs or drug paraphernalia
- Stolen, counterfeit, or recalled goods
- Illegal services
- Adult content (unless clearly marked as such)

Scam patterns to flag:
- Requests to pay off-platform (Venmo, CashApp, wire transfer, gift cards)
- Urgency/pressure language paired with below-market pricing ("act fast," "limited time only," "won't last" + unusually low price)
- Wire transfer or gift card payment requests
- "too good to be true" pricing with vague descriptions
- Requests for personal information (SSN, bank account, passwords)
- Shipping scams (seller pays shipping for large items)
- Fake seller behavior (new account, no reviews, generic photos)

Respond with JSON in this exact format:
{
  "violation": true/false,
  "confidence": "high" or "low",
  "flagged_phrases": ["phrase1", "phrase2"],
  "explanation": "Brief explanation of why this is flagged"
}`,
    model: 'gpt-4o-mini',
    temperature: 0.3,
  },

  jobs: {
    name: 'Employment Law & Scam Detection',
    systemPrompt: `You are an employment law compliance checker. Analyze this job posting for discriminatory hiring language and scam patterns.

Discriminatory language to flag:
- Age requirements (e.g., "must be under 30", "recent grad", "young professional")
- Gender preferences (e.g., "male preferred", "female staff")
- Disability discrimination (e.g., "must be able-bodied", "physically fit")
- Citizenship requirements not legally justified (e.g., "must be US citizen" for non-federal jobs)
- Marital/familial status requirements (e.g., "single", "no dependents")
- Pregnancy-related questions or requirements
- Religious affiliation requirements
- Non-essential physical requirements

Scam patterns to flag:
- Pyramid scheme or MLM recruiting language ("recruit distributors," "build your team," "unlimited earning potential")
- Unpaid labor disguised as paid job ("paid in exposure," "paid in experience," "internship with no pay and no college credit")
- Payment before starting job (equipment fees, training costs, background check fees)
- Wire transfer or gift card payment
- Personal requests for money/deposits
- Vague job descriptions with unusually high pay for simple work
- "work from home" with no specific company information

Respond with JSON in this exact format:
{
  "violation": true/false,
  "confidence": "high" or "low",
  "flagged_phrases": ["phrase1", "phrase2"],
  "explanation": "Brief explanation of why this is flagged"
}`,
    model: 'gpt-4o-mini',
    temperature: 0.3,
  },

  gigs: {
    name: 'Gig Safety & Scam Detection',
    systemPrompt: `You are a gig safety checker. Analyze this gig posting for discriminatory language and scam patterns.

Discriminatory language to flag:
- Age requirements (e.g., "must be young," "energetic worker")
- Gender preferences
- Disability discrimination (e.g., "must be strong," "physically fit")
- Citizenship requirements not legally justified
- Marital/familial status requirements
- Religious affiliation requirements

Scam patterns to flag:
- Pyramid scheme or MLM recruiting
- Unpaid labor disguised as paid gig
- Payment before starting gig
- Wire transfer or gift card payment
- Personal requests for money/deposits
- "too good to be true" pay for simple tasks
- Requests for personal information
- Off-platform payment requests
- Vague gig descriptions with unusually high pay

Respond with JSON in this exact format:
{
  "violation": true/false,
  "confidence": "high" or "low",
  "flagged_phrases": ["phrase1", "phrase2"],
  "explanation": "Brief explanation of why this is flagged"
}`,
    model: 'gpt-4o-mini',
    temperature: 0.3,
  },

  community: {
    name: 'Harassment & Doxxing Detection',
    systemPrompt: `You are a community safety checker. Analyze this community post for harassment, threats, or doxxing.

Harassment/threats to flag:
- Personal attacks targeting a specific individual
- Threats of violence or harm
- Hate speech targeting protected groups
- Repeated targeted harassment against a person
- Bullying or intimidation tactics

Doxxing to flag:
- Posting another person's home address without consent
- Posting phone numbers without consent
- Posting email addresses without consent
- Posting other identifying information (SSN, workplace, license plate) without consent
- Revealing private personal information to harass or intimidate

Context matters: Sharing one's own information is fine. Sharing public information is fine. Doxxing is malicious publication of private information.

Respond with JSON in this exact format:
{
  "violation": true/false,
  "confidence": "high" or "low",
  "flagged_phrases": ["phrase1", "phrase2"],
  "explanation": "Brief explanation of why this is flagged"
}`,
    model: 'gpt-4o-mini',
    temperature: 0.3,
  },
};

async function callOpenAI(systemPrompt, userMessage, model = 'gpt-4o-mini', temperature = 0.3) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callGroq(systemPrompt, userMessage, model = 'llama-3.3-70b-versatile', temperature = 0.3) {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export default async function handler(req, res) {
  if (!requireMethod(req, res)) return;

  const identifier = req.headers['x-forwarded-for'] || 'anonymous';
  if (!(await checkRateLimit(limiter, identifier, res))) return;

  try {
    const { category, content } = req.body;

    if (!category || typeof category !== 'string') {
      sendJson(res, 400, { error: 'category is required and must be a string' });
      return;
    }

    if (!content || typeof content !== 'string') {
      sendJson(res, 400, { error: 'content is required and must be a string' });
      return;
    }

    const rule = moderationRules[category];
    
    if (!rule) {
      sendJson(res, 400, { error: `No moderation rule found for category: ${category}` });
      return;
    }

    let result;
    let usedProvider = 'openai';

    try {
      result = await callOpenAI(
        rule.systemPrompt,
        content,
        rule.model,
        rule.temperature
      );
      console.log('[moderate] used provider:', usedProvider);
    } catch (openaiError) {
      console.warn('[moderate] OpenAI failed, falling back to Groq:', openaiError.message);
      
      try {
        result = await callGroq(
          rule.systemPrompt,
          content,
          'llama-3.3-70b-versatile',
          rule.temperature
        );
        usedProvider = 'groq';
        console.log('[moderate] used provider:', usedProvider);
      } catch (groqError) {
        console.error('[moderate] Both OpenAI and Groq failed:', groqError.message);
        throw new Error(`All AI providers failed. OpenAI: ${openaiError.message}, Groq: ${groqError.message}`);
      }
    }

    const parsed = JSON.parse(result);
    
    // Return the AI response with the expected shape
    sendJson(res, 200, {
      violation: parsed.violation || false,
      confidence: parsed.confidence || null,
      flagged_phrases: parsed.flagged_phrases || [],
      explanation: parsed.explanation || '',
    });
  } catch (error) {
    console.error('[moderate] Moderation check failed:', error);
    sendJson(res, 500, { error: error.message || 'Moderation check failed' });
  }
}
