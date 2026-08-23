import { debugTicketConfirmGates, isDirectTicketRequest } from '../api/_utils/grindbotConfirm.js';

const turns = [
  {
    label: 'Turn 1 — first ticket ask',
    messages: [
      { role: 'assistant', content: "Hey! I'm GrindBot. How can I help you today?" },
      { role: 'user', content: 'Can you just file this ticket for me?' },
    ],
  },
  {
    label: 'Turn 2 — issue description',
    messages: [
      { role: 'assistant', content: "Hey! I'm GrindBot. How can I help you today?" },
      { role: 'user', content: 'Can you just file this ticket for me?' },
      { role: 'assistant', content: 'Sorry that happened — what exactly is going on with your account?' },
      { role: 'user', content: "My account got hacked and I can't get in" },
    ],
  },
  {
    label: 'Turn 3 — troubleshooting question',
    messages: [
      { role: 'assistant', content: "Hey! I'm GrindBot. How can I help you today?" },
      { role: 'user', content: 'Can you just file this ticket for me?' },
      { role: 'assistant', content: 'Sorry that happened — what exactly is going on with your account?' },
      { role: 'user', content: "My account got hacked and I can't get in" },
      { role: 'assistant', content: 'Have you reset your password or still cannot get into your email?' },
    ],
  },
  {
    label: 'Turn 4a — "file a ticket" (should bypass)',
    messages: [
      { role: 'assistant', content: "Hey! I'm GrindBot. How can I help you today?" },
      { role: 'user', content: 'Can you just file this ticket for me?' },
      { role: 'assistant', content: 'Sorry that happened — what exactly is going on with your account?' },
      { role: 'user', content: "My account got hacked and I can't get in" },
      { role: 'assistant', content: 'Have you reset your password or still cannot get into your email?' },
      { role: 'user', content: 'Can you just file a ticket for me' },
    ],
  },
  {
    label: 'Turn 4b — same phrasing as turn 1 ("file this ticket")',
    messages: [
      { role: 'assistant', content: "Hey! I'm GrindBot. How can I help you today?" },
      { role: 'user', content: 'Can you just file this ticket for me?' },
      { role: 'assistant', content: 'Sorry that happened — what exactly is going on with your account?' },
      { role: 'user', content: "My account got hacked and I can't get in" },
      { role: 'assistant', content: 'Have you reset your password or still cannot get into your email?' },
      { role: 'user', content: 'Can you just file this ticket for me?' },
    ],
  },
];

for (const turn of turns) {
  console.log(`\n=== ${turn.label} ===`);
  console.log(JSON.stringify(debugTicketConfirmGates(turn.messages), null, 2));
}

console.log('\nPattern probe:');
for (const text of ['Can you just file this ticket for me?', 'Can you just file a ticket for me']) {
  console.log(`${text} => isDirectTicketRequest: ${isDirectTicketRequest(text)}`);
}
