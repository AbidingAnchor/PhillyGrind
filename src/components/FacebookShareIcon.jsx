export default function FacebookShareIcon({ size = 18, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M22 10.981L15.027 2v4.99C3.075 6.99 1.711 16.678 2.043 22l.007-.041c.502-2.685.712-6.986 12.977-6.986v4.99L22 10.98z" />
    </svg>
  );
}
