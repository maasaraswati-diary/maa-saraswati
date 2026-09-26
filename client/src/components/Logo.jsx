/**
 * Inline brand mark - a red arch (temple silhouette) holding a cow and a milk
 * drop, echoing the shape used on the MAA SARASWATI packaging.
 */
export default function Logo({ size = 44, showText = false }) {
  const gid = `ms-logo-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Maa Saraswati logo"
      style={{ flex: 'none' }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2fbf6d" />
          <stop offset="1" stopColor="#0a5c34" />
        </linearGradient>
      </defs>
      {/* arch */}
      <path
        d="M32 3c11 0 20 6.5 20 15.5V48a13 13 0 01-13 13H25A13 13 0 0112 48V18.5C12 9.5 21 3 32 3z"
        fill={`url(#${gid})`}
      />
      {/* cow silhouette */}
      <path
        d="M22 43c-2.4 0-4-1.4-4-3.3 0-1.2.7-2.2 1.8-2.8-.5-2.6.9-5.1 3.4-6.4l1.3-2.3 1.4 1.7c.6-.1 1.3-.2 2-.2 4.1 0 7.4 3.2 7.4 7.2 0 .7-.1 1.4-.3 2 .9.6 1.5 1.6 1.5 2.7 0 1.9-1.6 3.4-3.6 3.4z"
        fill="#fff"
        opacity="0.97"
      />
      <circle cx="24.3" cy="36.4" r="1" fill="#0a5c34" />
      {/* milk drop */}
      <path
        d="M39.5 27.5c1.9 2.6 3 4.2 3 5.5a3 3 0 11-6 0c0-1.3 1.1-2.9 3-5.5z"
        fill="#fff"
        opacity="0.9"
      />
      {/* base ribbon */}
      <path
        d="M18 54h28"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity="0.55"
      />
      {showText && null}
    </svg>
  );
}
