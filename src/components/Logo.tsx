import { useTheme } from '../context/ThemeContext';

/*
  Marca Zenkuri: selo hanko com 全. Sem wordmark mostra só o selo; com wordmark
  usa a assinatura completa (selo + "Zenkuri"), que já inclui o selo. Os
  arquivos variam por tema: escuro (#E5533A) e papel (#B93A23).
*/
interface LogoProps {
  /** altura da marca em px */
  size?: number;
  /** mostra a assinatura completa (selo + "Zenkuri") */
  withWordmark?: boolean;
  /** linha pequena sob a assinatura */
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
