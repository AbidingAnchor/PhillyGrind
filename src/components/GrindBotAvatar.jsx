const PERSONA_EMOJIS = {
  hustle: '🦅',
  sly: '🦝',
  nettie: '🐦',
};

export default function GrindBotAvatar({ size = 40, className = '', persona = null }) {
  const emoji = PERSONA_EMOJIS[persona] || '💬';

  return (
    <span
      className={`grindbot-avatar grindbot-avatar--${persona || 'default'} ${className}`.trim()}
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: `${size * 0.65}px` }}
    >
      {emoji}
    </span>
  );
}
