import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSteam } from '../context/SteamContext';
import { useI18n } from '../i18n';
import { messageForCode } from '../i18n/useErrorMessage';
import type { PlatformProgress, SyncProgress } from '../lib/api';
import { PLATFORM_META } from '../lib/platforms';
import '../styles/update-toast.css';

/** Time the toast stays after a fully successful update. */
const AUTO_DISMISS_MS = 5000;

type ToastState = 'running' | 'done' | 'error';

function toastState(progress: SyncProgress): ToastState {
  if (progress.finishedAt === undefined) return 'running';
  return progress.platforms.some((item) => item.status === 'error') ? 'error' : 'done';
}

interface UpdateRowProps {
  item: PlatformProgress;
}

function UpdateRow({ item }: UpdateRowProps) {
  const { t, formatNumber } = useI18n();
  const name = PLATFORM_META[item.platform].short;
  const percent = formatNumber(item.percent / 100, { style: 'percent', maximumFractionDigits: 0 });

  let step: string;
  switch (item.status) {
    case 'achievements':
      step = item.total > 0
        ? t('update.step.achievementsCount', { done: formatNumber(item.done), total: formatNumber(item.total) })
        : t('update.step.achievements');
      break;
    case 'error': {
      const reason = messageForCode(t, item.errorCode);
      step = reason ? t('update.step.failedWithReason', { reason }) : t('update.step.failed');
      break;
    }
    default:
      step = t(`update.step.${item.status}`);
  }

  return (
    <li className="update-row" data-status={item.status}>
      <div className="update-row-head">
        <span className="update-row-name">
          <img src={PLATFORM_META[item.platform].logo} alt="" className="h-4 w-4 shrink-0 object-contain" />
          {name}
        </span>
        <span className="update-row-percent">{percent}</span>
      </div>
      <p className="update-row-step">{step}</p>
      <div
        className="update-row-bar"
        role="progressbar"
        aria-label={t('update.toast.progressLabel', { platform: name })}
        aria-valuenow={item.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="update-row-fill" style={{ width: `${item.percent}%` }} />
      </div>
    </li>
  );
}

/**
 * Bottom-left popup with the per-source progress of the running update.
 * Mounted once in the authed shell. It closes itself shortly after a clean
 * finish and stays on screen after an error until the user closes it.
 */
export function UpdateProgressToast() {
  const { progress } = useSteam();
  const { t } = useI18n();
  const [dismissedRunId, setDismissedRunId] = useState<string | null>(null);

  const runId = progress?.runId ?? null;
  const state = progress ? toastState(progress) : null;

  useEffect(() => {
    if (runId === null || state !== 'done') return undefined;
    const timer = setTimeout(() => setDismissedRunId(runId), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [runId, state]);

  const visible = progress !== null
    && state !== null
    && progress.platforms.length > 0
    && dismissedRunId !== progress.runId;

  // The live region stays mounted so screen readers pick up its text changes.
  // Only the summary is announced (start and end), never every progress tick.
  const summary = (
    <div className="sr-only" role="status" aria-live="polite">
      {visible ? t(`update.toast.${state}`) : ''}
    </div>
  );

  if (!visible) return summary;

  return (
    <>
      {summary}
      <div className="popover update-toast" data-state={state}>
        <div className="update-toast-head">
          <p className="update-toast-title" aria-hidden="true">{t(`update.toast.${state}`)}</p>
          <button
            type="button"
            className="update-toast-close"
            aria-label={t('update.toast.close')}
            onClick={() => setDismissedRunId(progress.runId)}
          >
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <ul className="update-toast-list">
          {progress.platforms.map((item) => (
            <UpdateRow key={item.platform} item={item} />
          ))}
        </ul>
      </div>
    </>
  );
}
