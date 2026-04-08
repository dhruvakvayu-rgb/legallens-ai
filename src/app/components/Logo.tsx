import { Link } from 'react-router';

interface LogoProps {
  /** Show icon + text (default) or icon only */
  variant?: 'full' | 'icon';
  /** Override size in px for the icon container */
  size?: number;
  className?: string;
}

/**
 * LegalLens AI brand logo.
 * Renders an SVG document-under-magnifying-glass icon with optional wordmark.
 * Automatically adapts stroke colors via CSS currentColor + Tailwind dark mode.
 */
export function Logo({ variant = 'full', size = 40, className = '' }: LogoProps) {
  return (
    <Link
      to="/"
      aria-label="LegalLens AI – home"
      className={`flex items-center gap-3 group select-none ${className}`}
    >
      <LogoIcon size={size} />
      {variant === 'full' && <LogoWordmark />}
    </Link>
  );
}

export function LogoIcon({ size = 40 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow duration-200 flex-shrink-0"
    >
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: size * 0.65, height: size * 0.65 }}
        aria-hidden="true"
      >
        {/* Document body */}
        <rect x="2" y="1" width="18" height="23" rx="2.5" stroke="white" strokeWidth="1.8" fill="none" />
        {/* Folded corner */}
        <path d="M14 1 L20 7 L14 7 Z" stroke="white" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
        {/* Document lines */}
        <line x1="6" y1="13" x2="16" y2="13" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="6" y1="17" x2="16" y2="17" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="6" y1="21" x2="12" y2="21" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
        {/* Magnifying glass circle */}
        <circle cx="25" cy="26" r="9" stroke="white" strokeWidth="1.9" fill="none" />
        {/* Lens inner highlight */}
        <circle cx="22.5" cy="23.5" r="2" fill="white" opacity="0.3" />
        {/* Handle */}
        <line x1="31.5" y1="32.5" x2="37" y2="38" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function LogoWordmark() {
  return (
    <div className="flex flex-col leading-none">
      <span className="text-[17px] font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent tracking-tight">
        LegalLens AI
      </span>
      <span className="text-[10px] text-muted-foreground tracking-wide mt-0.5">
        Understand. Evaluate. Decide.
      </span>
    </div>
  );
}
