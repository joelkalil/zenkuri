import type { Shape } from '../../types';
import type { authPtBR } from './pt-BR';

export const authEn = {
  login: {
    title: 'Log in',
    registerTitle: 'Create your account',
    lede: 'Your platinum guide: track achievements and 100% completions across every platform.',
    registerLede: 'Start recording your achievements in one place.',
    modeLabel: 'Log in or create an account',
    tabLogin: 'Log in',
    tabRegister: 'Create account',
    username: 'Username',
    usernamePlaceholder: 'e.g. joel',
    displayName: 'Display name',
    optional: '(optional)',
    displayNamePlaceholder: 'How you want to appear in the app',
    password: 'Password',
    passwordPlaceholder: 'Your password',
    passwordNewPlaceholder: 'At least 6 characters',
    confirm: 'Confirm password',
    confirmPlaceholder: 'Repeat the password',
    submitLogin: 'Log in',
    submitRegister: 'Create account',
    busyLogin: 'Logging in…',
    busyRegister: 'Creating account…',
    footer: 'After logging in, connect your Steam, PSN and RetroAchievements accounts.',
  },
  errors: {
    usernameRequired: 'Enter your username.',
    passwordRequired: 'Enter your password.',
    passwordTooShort: 'The password must be at least 6 characters long.',
    passwordMismatch: 'The passwords do not match.',
    generic: 'Could not authenticate.',
  },
} satisfies Shape<typeof authPtBR>;
