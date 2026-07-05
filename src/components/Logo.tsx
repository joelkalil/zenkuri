/*
  Zenkuri brand lockup. A rounded-square violet mark with a stylized "Z" plus the
  "Zenkuri" wordmark (zen ink / kuri violet), matching the product art.
*/
interface LogoProps {
  /** mark size in px */
  size?: number;
  /** show the "Zenkuri" wordmark next to the mark */
  withWordmark?: boolean;
  /** small tagline under the wordmark */
  tagline?: string;
  className?: string;
}

export function Logo({ size = 32, withWordmark = true, tagline, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span
        className="relative grid shrink-0 place-items-center overflow-hidden rounded-[26%] shadow-[0_6px_22px_-6px_color-mix(in_oklab,var(--color-violet-600)_65%,transparent)]"
        style={{ width: size, height: size }}
      >
        <img src="/zenkuri-logo.png" alt="Zenkuri" className="h-full w-full object-cover" />
        <span className="pointer-events-none absolute inset-0 rounded-[26%] ring-1 ring-inset ring-white/10" />
      </span>
      {withWordmark && (
        <div className="leading-none">
          <p className="font-display text-[16px] font-bold tracking-tight" style={{ fontSize: size * 0.5 }}>
            <span className="text-gray-100">Zen</span>
            <span className="text-violet-400">kuri</span>
          </p>
          {tagline && <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-gray-600">{tagline}</p>}
        </div>
      )}
    </div>
  );
}
