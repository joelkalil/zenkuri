import type { Shape } from '../../types';
import type { updatePtBR } from './pt-BR';

export const updateEn = {
  toast: {
    running: 'Updating…',
    done: 'Update complete',
    error: 'Update failed',
    close: 'Close',
    progressLabel: 'Update progress: {platform}',
  },
  step: {
    queued: 'Queued',
    library: 'Library',
    media: 'Media',
    achievements: 'Achievements',
    achievementsCount: 'Achievements {done}/{total}',
    done: 'Done',
    failed: 'Failed',
    failedWithReason: 'Failed: {reason}',
  },
} satisfies Shape<typeof updatePtBR>;
