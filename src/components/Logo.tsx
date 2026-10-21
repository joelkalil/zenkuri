import { useTheme } from '../context/ThemeContext';

/*
  Zenkuri brand: hanko seal with 全. Without the wordmark it shows only the
  seal; with it, the full signature (seal + "Zenkuri"), which already includes
  the seal. Files vary by theme: dark (#E5533A) and paper (#B93A23).
  The brand name is not translated, so there are no message keys here.
*/
interface LogoProps {
  /** brand height in px */
  size?: number;
  /** shows the full signature (seal + "Zenkuri") */
  withWordmark?: boolean;
  /** small line under the signature (already translated by the caller) */
  tagline?: string;
  className?: string;
}

const WORDMARK_RATIO = 215 / 64;

export function Logo({ size = 32, withWordmark = true, tagline, className = '' }: LogoProps) {
  const { theme } = useTheme();
  const light = theme === 'zenkuri-claro';
  const mark = light ? '/brand/mark-paper.svg' : '/brand/mark.svg';
  const wordmark = light ? '/brand/wordmark-claro.svg' : '/brand/wordmark.svg';

  return (
    <div className={`inline-flex flex-col ${className}`}>
      {withWordmark ? (
        <img src={wordmark} alt="Zenkuri" height={size} width={Math.round(size * WORDMARK_RATIO)} style={{ height: size, width: 'auto' }} />
      ) : (
        <img src={mark} alt="Zenkuri" width={size} height={size} style={{ width: size, height: size }} />
      )}
      {withWordmark && tagline && (
        <p className="mt-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-gray-600">{tagline}</p>
      )}
    </div>
  );
}
