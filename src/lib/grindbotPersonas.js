export const PERSONAS = {
  hustle: {
    id: 'hustle',
    name: 'Hustle',
    emoji: '🦅',
    color: '#c2410c',
    scope: 'Jobs & Gigs',
    description: 'Jobs & gigs — posting, bidding, pay',
    welcome: "Yo, I'm Hustle. Ask me about posting work, bidding, pay, or getting a gig done.",
    placeholder: 'Ask about jobs, gigs, pay...',
    chips: [
      'How do I post a gig?',
      'How do bids work?',
      'When do I get paid?',
      'How much are fees?',
    ],
  },
  sly: {
    id: 'sly',
    name: 'Sly',
    emoji: '🦝',
    color: '#0369a1',
    scope: 'Marketplace',
    description: 'Marketplace — pricing, listings, deals',
    welcome: "I'm Sly. Let's talk price, listings, and how not to get got.",
    placeholder: 'Ask about marketplace pricing, listings...',
    chips: [
      "What's this worth?",
      'How do I write a listing?',
      'How do I negotiate?',
      'How do verified badges work?',
    ],
  },
  nettie: {
    id: 'nettie',
    name: 'Nettie',
    emoji: '🐦',
    color: '#15803d',
    scope: 'Community & Safety',
    description: 'Community & safety — reporting, how PhillyGrind works',
    welcome: "Hey neighbor, I'm Nettie. Ask me how PhillyGrind works, how to report something, or any trust-and-safety questions.",
    placeholder: 'Ask about reporting, safety, platform help...',
    chips: [
      'How do I report something?',
      'How does PhillyGrind work?',
      'Is this a scam?',
      'How do I contact support?',
    ],
  },
};

export const DEFAULT_PERSONA = 'hustle';
