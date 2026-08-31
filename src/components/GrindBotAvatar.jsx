export default function GrindBotAvatar({ size = 40, className = '' }) {
  return (
    <svg
      className={`grindbot-avatar grindbot-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="40" height="40" rx="12" className="gb-bg" />
      <path
        className="gb-accent"
        d="M20 3.2 21.7 6.3h1.5c.36 0 .56.44.34.74L21.9 10h-3.8l-1.64-2.96c-.22-.3-.02-.74.34-.74h1.5L20 3.2Z"
      />
      <rect x="18.7" y="9" width="2.6" height="4.2" rx="0.6" className="gb-accent" />
      <path
        className="gb-accent"
        d="M20.2 16.6c-4.2 0-7.5 3.2-7.5 7.2s3.3 7.2 7.5 7.2c2.6 0 4.9-1.2 6.3-3.1l-2-1.4c-.9 1.3-2.5 2.1-4.3 2.1-2.9 0-5.1-2.2-5.1-4.8s2.2-4.8 5.1-4.8c1.8 0 3.4.8 4.3 2.1l2-1.4c-1.4-1.9-3.7-3.1-6.3-3.1Zm1.6 6.2h-3.4v2.3H26v-2.3h-4.2Z"
      />
    </svg>
  );
}
