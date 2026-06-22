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
        className="relative grid shrink-0 place-items-center rounded-[28%] bg-gradient-to-br from-violet-400 via-violet-600 to-indigo-700 font-black text-white shadow-[0_6px_20px_-4px_rgba(124,58,237,0.6)]"
        style={{ width: size, height: size, fontSize: size * 0.56 }}
      >
        <span className="-mt-px italic tracking-tighter">Z</span>
        <span className="pointer-events-none absolute inset-0 rounded-[28%] ring-1 ring-inset ring-white/20" />
      </span>
      {withWordmark && (
        <div className="leading-none">
          <p className="text-[16px] font-extrabold tracking-tight" style={{ fontSize: size * 0.5 }}>
            <span className="text-gray-100">Zen</span>
            <span className="text-violet-400">kuri</span>
          </p>
          {tagline && <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-gray-600">{tagline}</p>}
        </div>
      )}
    </div>
  );
}
