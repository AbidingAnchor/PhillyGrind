import { useRef, useState } from 'react';
import { Bot, Send, X } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { hasSupabaseConfig, supabase } from '../lib/supabase.js';

const welcomeMessage = {
  role: 'assistant',
  content: "Yo, I'm GrindBot. Ask me how PhillyGrind works, how bids and escrow work, or how to post your next job or gig.",
};

const workTypeOptions = [
  { label: 'Jobs (steady work)', value: 'jobs' },
  { label: 'Gigs (one-time tasks)', value: 'gigs' },
  { label: 'Both', value: 'both' },
];

const categoryOptions = [
  'Moving',
  'Cleaning',
  'Food & Cooking',
  'Delivery',
  'Construction',
  'Retail',
  'Customer Service',
  'Tech',
  'Other',
];

const payOptions = [
  { label: 'Under $15/hr', value: 'under15' },
  { label: '$15-$25/hr', value: '15to25' },
  { label: '$25-$50/hr', value: '25to50' },
  { label: '$50+/hr', value: '50plus' },
  { label: 'Any', value: 'any' },
];

const categoryMap = {
  Moving: { jobs: ['Warehouse'], gigs: ['Moving'] },
  Cleaning: { jobs: [], gigs: ['Cleaning'] },
  'Food & Cooking': { jobs: ['Restaurant'], gigs: ['Events'] },
  Delivery: { jobs: ['Warehouse'], gigs: ['Delivery'] },
  Construction: { jobs: ['Warehouse'], gigs: ['Handyman'] },
  Retail: { jobs: ['Retail'], gigs: [] },
  'Customer Service': { jobs: ['Retail', 'Office'], gigs: ['Events'] },
  Tech: { jobs: ['Office'], gigs: [] },
  Other: { jobs: [], gigs: [] },
};

function parsePayAmount(pay) {
  const match = String(pay || '').replace(/,/g, '').match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  return match ? Number(match[1]) : null;
}

function matchesPayRange(pay, range) {
  if (range === 'any') return true;
  const amount = parsePayAmount(pay);
  if (amount === null) return true;

  if (range === 'under15') return amount < 15;
  if (range === '15to25') return amount >= 15 && amount <= 25;
  if (range === '25to50') return amount >= 25 && amount <= 50;
  if (range === '50plus') return amount >= 50;

  return true;
}

function routeForListing(listing) {
  return listing.type === 'gig' ? `/gigs/${listing.id}` : `/jobs/${listing.id}`;
}

function GrindBot() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([welcomeMessage]);
  const [input, setInput] = useState('');
  const [neighborhoodInput, setNeighborhoodInput] = useState('');
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matchStep, setMatchStep] = useState('idle');
  const [matchPrefs, setMatchPrefs] = useState({});
  const threadRef = useRef(null);

  async function removeUnavailableJobMatches(listings) {
    const listingIds = listings.map((listing) => listing.id).filter(Boolean);
    if (!listingIds.length) return listings;

    try {
      const response = await fetch('/api/delete-listing?action=unavailable-listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ listing_ids: listingIds }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not check listing availability.');

      const unavailableIds = new Set(payload.unavailableListingIds || []);
      return listings.filter((listing) => !unavailableIds.has(listing.id));
    } catch (error) {
      console.warn(error);
      return listings;
    }
  }

  function scrollThread() {
    window.setTimeout(() => {
      threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  }

  function addAssistantMessage(content, extra = {}) {
    setMessages((current) => [...current, { role: 'assistant', content, ...extra }]);
    scrollThread();
  }

  function addUserMessage(content) {
    setMessages((current) => [...current, { role: 'user', content }]);
    scrollThread();
  }

  function startMatchFlow() {
    setStatus('');
    setMatchPrefs({});
    setNeighborhoodInput('');
    setMatchStep('workType');
    addAssistantMessage('Bet. What kind of work are you looking for?', {
      kind: 'choices',
      choices: workTypeOptions,
    });
  }

  function chooseWorkType(option) {
    addUserMessage(option.label);
    setMatchPrefs({ workType: option.value });
    setMatchStep('category');
    addAssistantMessage('What kind of work do you want?', {
      kind: 'choices',
      choices: categoryOptions.map((category) => ({ label: category, value: category })),
    });
  }

  function chooseCategory(option) {
    addUserMessage(option.label);
    setMatchPrefs((current) => ({ ...current, category: option.value }));
    setMatchStep('neighborhood');
    addAssistantMessage('What neighborhood or area should I search around?', { kind: 'neighborhood' });
  }

  function submitNeighborhood(event) {
    event.preventDefault();
    const neighborhood = neighborhoodInput.trim();
    if (!neighborhood) return;

    addUserMessage(neighborhood);
    setMatchPrefs((current) => ({ ...current, neighborhood }));
    setNeighborhoodInput('');
    setMatchStep('pay');
    addAssistantMessage('What pay range are you aiming for?', {
      kind: 'choices',
      choices: payOptions,
    });
  }

  async function loadListingsForMatch(type, prefs) {
    const table = type === 'gig' ? 'gigs' : 'jobs';
    const mappedCategories = categoryMap[prefs.category]?.[type === 'gig' ? 'gigs' : 'jobs'] || [];
    let query = supabase
      .from(table)
      .select(type === 'gig'
        ? 'id,title,category,neighborhood,pay,description,post_type,status,boost_pending,created_at'
        : 'id,title,category,neighborhood,pay,description,boost_pending,created_at')
      .eq('boost_pending', false)
      .order('created_at', { ascending: false })
      .limit(30);

    if (mappedCategories.length) {
      query = query.in('category', mappedCategories);
    }

    if (prefs.neighborhood) {
      query = query.ilike('neighborhood', `%${prefs.neighborhood}%`);
    }

    if (type === 'gig') {
      query = query.eq('status', 'open');
    }

    const { data, error } = await query;
    if (error) throw error;

    const matches = (data ?? [])
      .filter((listing) => matchesPayRange(listing.pay, prefs.payRange))
      .map((listing) => ({ ...listing, type }));

    return type === 'job' ? removeUnavailableJobMatches(matches) : matches;
  }

  async function choosePayRange(option) {
    const prefs = { ...matchPrefs, payRange: option.value };
    setMatchPrefs(prefs);
    setMatchStep('idle');
    setMatching(true);
    addUserMessage(option.label);
    addAssistantMessage('I got you. Searching PhillyGrind for the best matches now...');

    try {
      if (!hasSupabaseConfig) {
        throw new Error('Supabase is not configured.');
      }

      const searchJobs = prefs.workType === 'jobs' || prefs.workType === 'both';
      const searchGigs = prefs.workType === 'gigs' || prefs.workType === 'both';
      const [jobs, gigs] = await Promise.all([
        searchJobs ? loadListingsForMatch('job', prefs) : Promise.resolve([]),
        searchGigs ? loadListingsForMatch('gig', prefs) : Promise.resolve([]),
      ]);
      const results = [...jobs, ...gigs]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5);

      if (!results.length) {
        addAssistantMessage("I didn't find a clean match right now. Try a nearby neighborhood, choose Both, pick Any pay, or check back later.");
        return;
      }

      addAssistantMessage(`Found ${results.length} solid match${results.length === 1 ? '' : 'es'} for you.`, {
        kind: 'matches',
        results,
      });
    } catch (error) {
      setStatus(error.message || 'Could not find matches right now.');
    } finally {
      setMatching(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const nextMessages = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setStatus('');
    setSending(true);
    scrollThread();

    try {
      const response = await fetch('/api/grindbotai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: nextMessages.filter((message) => message.role !== 'system'),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'GrindBot could not answer right now.');
      }

      setMessages((current) => [...current, { role: 'assistant', content: payload.reply }]);
      scrollThread();
    } catch (error) {
      setStatus(error.message || 'GrindBot is taking five. Try again in a minute.');
    } finally {
      setSending(false);
    }
  }

  if (!session?.access_token) return null;

  return (
    <div className="grindbot-widget">
      {open && (
        <section className="grindbot-panel" aria-label="GrindBot chat">
          <header className="grindbot-header">
            <div>
              <span className="eyebrow">PhillyGrind Help</span>
              <h2>GrindBot</h2>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close GrindBot">
              <X size={18} />
            </button>
          </header>
          <div className="grindbot-thread" ref={threadRef}>
            {messages.map((message, index) => {
              const showFindWork = index === 0 && message.role === 'assistant' && matchStep === 'idle';

              return (
                <article key={`${message.role}-${index}`} className={message.role === 'user' ? 'grindbot-message user' : 'grindbot-message'}>
                  <span>{message.role === 'user' ? 'You' : 'GrindBot'}</span>
                  <p>{message.content}</p>
                  {showFindWork && (
                    <button className="grindbot-match-button" type="button" onClick={startMatchFlow} disabled={matching}>
                      Find me work
                    </button>
                  )}
                  {message.kind === 'choices' && (
                    <div className="grindbot-choice-grid">
                      {message.choices.map((choice) => (
                        <button
                          key={choice.value}
                          type="button"
                          disabled={
                            !(
                              (matchStep === 'workType' && workTypeOptions.some((option) => option.value === choice.value))
                              || (matchStep === 'category' && categoryOptions.includes(choice.value))
                              || (matchStep === 'pay' && payOptions.some((option) => option.value === choice.value))
                            )
                          }
                          onClick={() => {
                            if (matchStep === 'workType') chooseWorkType(choice);
                            if (matchStep === 'category') chooseCategory(choice);
                            if (matchStep === 'pay') choosePayRange(choice);
                          }}
                        >
                          {choice.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {message.kind === 'neighborhood' && matchStep === 'neighborhood' && (
                    <form className="grindbot-inline-form" onSubmit={submitNeighborhood}>
                      <input
                        value={neighborhoodInput}
                        onChange={(event) => setNeighborhoodInput(event.target.value)}
                        placeholder="South Philly, Fishtown, Germantown..."
                      />
                      <button type="submit">Next</button>
                    </form>
                  )}
                  {message.kind === 'matches' && (
                    <div className="grindbot-results">
                      {message.results.map((listing) => (
                        <a className="grindbot-result-card" href={routeForListing(listing)} key={`${listing.type}-${listing.id}`}>
                          <span>{listing.type === 'gig' ? 'Gig' : 'Job'}</span>
                          <strong>{listing.title}</strong>
                          <small>{listing.pay} · {listing.neighborhood}</small>
                        </a>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
            {(sending || matching) && (
              <article className="grindbot-message">
                <span>GrindBot</span>
                <p>{matching ? 'Checking the boards...' : 'Working on it...'}</p>
              </article>
            )}
          </div>
          {status && <p className="grindbot-status">{status}</p>}
          <form className="grindbot-form" onSubmit={handleSubmit}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about bids, escrow, payouts..."
              aria-label="Ask GrindBot"
            />
            <button type="submit" disabled={sending || !input.trim()} aria-label="Send message">
              <Send size={18} />
            </button>
          </form>
        </section>
      )}
      <button className="grindbot-bubble" type="button" onClick={() => setOpen((value) => !value)} aria-label="Open GrindBot">
        <Bot size={24} />
      </button>
    </div>
  );
}

export default GrindBot;
