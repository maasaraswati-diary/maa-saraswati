/**
 * Inline SVG icon set. Every icon inherits `currentColor` and scales with the
 * font size, so they can be dropped anywhere without extra props.
 */

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function Svg({ size = 22, children, ...rest }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...base}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  ArrowRight: (p) => (
    <Svg {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  ),
  ArrowLeft: (p) => (
    <Svg {...p}>
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </Svg>
  ),
  ChevronDown: (p) => (
    <Svg {...p}>
      <path d="M6 9l6 6 6-6" />
    </Svg>
  ),
  ChevronRight: (p) => (
    <Svg {...p}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  ),
  Pause: (p) => (
    <Svg {...p}>
      <path d="M10 4v16M16 4v16" />
    </Svg>
  ),
  Play: (p) => (
    <Svg {...p}>
      <path d="M7 4l12 8-12 8z" />
    </Svg>
  ),
  Check: (p) => (
    <Svg {...p}>
      <path d="M20 6L9 17l-5-5" />
    </Svg>
  ),
  CheckCircle: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </Svg>
  ),
  X: (p) => (
    <Svg {...p}>
      <path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  ),
  Menu: (p) => (
    <Svg {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  ),
  Search: (p) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </Svg>
  ),
  Phone: (p) => (
    <Svg {...p}>
      <path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 005.5 5.5l1.5-2 4 1.5v3a2 2 0 01-2 2A16 16 0 014.5 5a2 2 0 012-2z" />
    </Svg>
  ),
  Mail: (p) => (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </Svg>
  ),
  MapPin: (p) => (
    <Svg {...p}>
      <path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </Svg>
  ),
  Clock: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  ),
  Star: ({ size = 18, fill = 'currentColor', ...rest }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      aria-hidden="true"
      {...rest}
    >
      <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45-4.7-4.6 6.5-.95z" />
    </svg>
  ),
  Truck: (p) => (
    <Svg {...p}>
      <path d="M2 7h11v9H2zM13 10h4.5L20 13v3h-7z" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </Svg>
  ),
  Leaf: (p) => (
    <Svg {...p}>
      <path d="M20 4C10 4 4 9 4 16c0 2 .6 3.4.6 3.4S9 12 20 11c0 0-6 3.5-10 8.9" />
    </Svg>
  ),
  Shield: (p) => (
    <Svg {...p}>
      <path d="M12 3l7.5 3v5.5c0 4.6-3.1 8.3-7.5 9.5-4.4-1.2-7.5-4.9-7.5-9.5V6z" />
      <path d="M9 12l2 2 4-4" />
    </Svg>
  ),
  Drop: (p) => (
    <Svg {...p}>
      <path d="M12 3s6 6.4 6 10.2A6 6 0 016 13.2C6 9.4 12 3 12 3z" />
    </Svg>
  ),
  Sparkle: (p) => (
    <Svg {...p}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    </Svg>
  ),
  Nutrient: (p) => (
    <Svg {...p}>
      <path d="M12 21c4-2 7-5.5 7-10a7 7 0 10-14 0c0 4.5 3 8 7 10z" />
      <path d="M12 7v8M9 10h6" />
    </Svg>
  ),
  Family: (p) => (
    <Svg {...p}>
      <circle cx="8" cy="7" r="2.4" />
      <circle cx="16.5" cy="8" r="2" />
      <path d="M3.5 20v-1.5A3.5 3.5 0 017 15h2a3.5 3.5 0 013.5 3.5V20z" />
      <path d="M14 20v-1.2A3.3 3.3 0 0117.3 15.5h.2a3 3 0 013 3V20z" />
    </Svg>
  ),
  Muscle: (p) => (
    <Svg {...p}>
      <path d="M6 8v8M10 6v12M14 8v8M18 10v4" />
    </Svg>
  ),
  Bone: (p) => (
    <Svg {...p}>
      <path d="M7.5 16.5l9-9" />
      <circle cx="6" cy="18" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
    </Svg>
  ),
  Fire: (p) => (
    <Svg {...p}>
      <path d="M12 21c3.3 0 6-2.4 6-5.5 0-4-4-5-4-9 0 0-2 1.5-2 4 0 1.2-.8 2-1.6 1.3C9.6 10.6 9 9 9 9s-3 2.3-3 6.5C6 18.6 8.7 21 12 21z" />
    </Svg>
  ),
  Snow: (p) => (
    <Svg {...p}>
      <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
    </Svg>
  ),
  Award: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="9" r="5.5" />
      <path d="M8.5 13.5L7 21l5-2.4L17 21l-1.5-7.5" />
    </Svg>
  ),
  Plus: (p) => (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  Minus: (p) => (
    <Svg {...p}>
      <path d="M5 12h14" />
    </Svg>
  ),
  Trash: (p) => (
    <Svg {...p}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    </Svg>
  ),
  Edit: (p) => (
    <Svg {...p}>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
    </Svg>
  ),
  Upload: (p) => (
    <Svg {...p}>
      <path d="M12 16V4M8 8l4-4 4 4" />
      <path d="M4 15v3.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V15" />
    </Svg>
  ),
  LogOut: (p) => (
    <Svg {...p}>
      <path d="M15 4h3.5A1.5 1.5 0 0120 5.5v13a1.5 1.5 0 01-1.5 1.5H15" />
      <path d="M10 8l-4 4 4 4M6 12h9" />
    </Svg>
  ),
  Lock: (p) => (
    <Svg {...p}>
      <rect x="5" y="10" width="14" height="10" rx="2.5" />
      <path d="M8 10V7.5a4 4 0 018 0V10" />
    </Svg>
  ),
  Chart: (p) => (
    <Svg {...p}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Svg>
  ),
  Grid: (p) => (
    <Svg {...p}>
      <rect x="4" y="4" width="7" height="7" rx="1.6" />
      <rect x="13" y="4" width="7" height="7" rx="1.6" />
      <rect x="4" y="13" width="7" height="7" rx="1.6" />
      <rect x="13" y="13" width="7" height="7" rx="1.6" />
    </Svg>
  ),
  Inbox: (p) => (
    <Svg {...p}>
      <path d="M3 13h5l1.5 3h5L16 13h5" />
      <path d="M4.5 5h15l1.5 8v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5z" />
    </Svg>
  ),
  Tag: (p) => (
    <Svg {...p}>
      <path d="M3 11V4.5A1.5 1.5 0 014.5 3H11l9 9-7.5 7.5z" />
      <circle cx="7.5" cy="7.5" r="1.4" fill="currentColor" stroke="none" />
    </Svg>
  ),
  Wallet: (p) => (
    <Svg {...p}>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 9.5V6.5A1.5 1.5 0 014.5 5H16" />
      <circle cx="16.5" cy="12.5" r="1.3" fill="currentColor" stroke="none" />
    </Svg>
  ),
  Instagram: (p) => (
    <Svg {...p}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
    </Svg>
  ),
  Facebook: (p) => (
    <Svg {...p}>
      <path d="M14 8.5V7a1.5 1.5 0 011.5-1.5H17V2.5h-2.5A4.5 4.5 0 0110 7v1.5H7.5V12H10v9.5h4V12h2.6l.4-3.5z" />
    </Svg>
  ),
  Youtube: (p) => (
    <Svg {...p}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10.5 9.5l5 2.5-5 2.5z" fill="currentColor" stroke="none" />
    </Svg>
  ),
  Whatsapp: (p) => (
    <Svg {...p}>
      <path d="M3.5 20.5l1.2-4A8 8 0 1120 17.6z" />
      <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5.7 0 1.2-.6 1.2-1.2l-1.7-.9-.9 1a5.6 5.6 0 01-2-2l1-.9-.9-1.7c-.6 0-1.2.5-1.2 1.2z" />
    </Svg>
  ),
  Refresh: (p) => (
    <Svg {...p}>
      <path d="M20 12a8 8 0 11-2.3-5.6" />
      <path d="M20 4v4.5h-4.5" />
    </Svg>
  ),
  Info: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.8v.4" />
    </Svg>
  ),
  Alert: (p) => (
    <Svg {...p}>
      <path d="M12 3.5l9 16H3z" />
      <path d="M12 9.5v4.5M12 17v.4" />
    </Svg>
  ),
  Globe: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.6 2.6 4 5.6 4 9s-1.4 6.4-4 9c-2.6-2.6-4-5.6-4-9s1.4-6.4 4-9z" />
    </Svg>
  ),
  Menu2: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </Svg>
  ),
};

export const ICON_MAP = {
  drop: Icon.Drop,
  shield: Icon.Shield,
  nutrition: Icon.Nutrient,
  family: Icon.Family,
  muscle: Icon.Muscle,
  bone: Icon.Bone,
  leaf: Icon.Leaf,
  fire: Icon.Fire,
  snow: Icon.Snow,
  award: Icon.Award,
  sparkle: Icon.Sparkle,
  truck: Icon.Truck,
  check: Icon.Check,
  shieldCheck: Icon.Shield,
};

export default Icon;
