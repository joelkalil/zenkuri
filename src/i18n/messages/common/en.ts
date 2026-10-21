import type { Shape } from '../../types';
import type { commonPtBR } from './pt-BR';

export const commonEn = {
  themes: {
    zenkuri: { label: 'Zenkuri', description: 'Warm sumi and vermilion' },
    paper: { label: 'Paper', description: 'Light paper and vermilion' },
  },
  language: {
    label: 'Language',
    hint: 'Applies to the whole app and is saved in this browser.',
  },
} satisfies Shape<typeof commonPtBR>;
