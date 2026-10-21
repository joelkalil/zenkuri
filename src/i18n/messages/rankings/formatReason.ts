import type { I18n } from '../../core';
import type { ReasonCode } from '../../../../server/rankings/types';

type ReasonI18n = Pick<I18n, 't' | 'plural' | 'formatNumber'>;

/** Rounded to one decimal, in the active locale ("1,2" in pt-BR, "1.2" in en). */
function oneDecimal(i18n: ReasonI18n, value: number): string {
  return i18n.formatNumber(value, { maximumFractionDigits: 1 });
}

/** Renders a rankings `ReasonCode` as text. The server only sends codes. */
export function formatReason(reason: ReasonCode, i18n: ReasonI18n): string {
  switch (reason.code) {
    case 'remaining':
      return i18n.plural('rankings.reasons.remaining', reason.count);
    case 'rarest':
      return i18n.t('rankings.reasons.rarest', { percent: oneDecimal(i18n, reason.percent) });
    case 'near':
      return i18n.t('rankings.reasons.near', { percent: oneDecimal(i18n, reason.percent) });
    case 'long':
      return i18n.t('rankings.reasons.long', { hours: oneDecimal(i18n, reason.hours) });
    case 'short':
      return i18n.t('rankings.reasons.short', { hours: oneDecimal(i18n, reason.hours) });
    case 'ultraRare':
      return i18n.plural('rankings.reasons.ultraRare', reason.count);
    case 'notStarted':
      return i18n.t('rankings.reasons.notStarted');
  }
}
