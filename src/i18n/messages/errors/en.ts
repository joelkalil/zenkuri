import type { Shape } from '../../types';
import type { errorsPtBR } from './pt-BR';

export const errorsEn = {
  generic: 'Something went wrong.',
  api: {
    auth: {
      unauthenticated: 'Your session has expired. Sign in again.',
      invalid_credentials: 'Wrong username or password.',
      invalid_username: 'Invalid username. Use 3 to 24 letters, numbers, dots, hyphens or underscores.',
      username_taken: 'This username is already taken.',
      password_too_short: 'The password is too short. Use at least 6 characters.',
      current_password_incorrect: 'The current password is incorrect.',
      display_name_required: 'Enter a display name.',
    },
    sync: {
      unsupported_platform: 'Unsupported platform.',
      not_configured: 'This platform is not connected yet. Connect it in Settings.',
      link_not_verified: 'This account link has not been verified yet. Confirm the code in Settings.',
      identifier_required: 'Enter the account identifier.',
      steam_id_required: 'Enter the SteamID64 or the Steam profile name.',
      steam_profile_not_found: 'Steam profile not found. Check the identifier.',
      steam_profile_unreadable: 'Could not read the Steam profile right now. Try again shortly.',
      steam_profile_private: 'The Steam profile is private. Make it public to continue.',
      steam_key_rejected: 'Steam rejected the server API key. See Tutorials.',
      psn_profile_not_found: 'PSN profile not found. Check the online ID.',
      ra_user_not_found: 'RetroAchievements user not found.',
      verification_not_linked: 'Link the account before verifying.',
      verification_no_pending_code: 'There is no pending verification code. Link the account again.',
      verification_code_not_found: 'The code has not shown up in the profile description yet. Save the profile and try again.',
      steam_service_not_configured: 'The Steam service is not configured on the server. See Tutorials.',
      ra_service_not_configured: 'The RetroAchievements service is not configured on the server. See Tutorials.',
      psn_service_not_configured: 'The PSN service is not configured on the server. See Tutorials.',
      psn_credential_expired: 'The PSN service credential has expired. Update ZENKURI_PSN_NPSSO in .env and restart the server. See Tutorials.',
      in_progress: 'An update is already running. Wait for it to finish.',
    },
    game: {
      not_found: 'Game not found.',
    },
    collections: {
      name_required: 'Enter a name for the collection.',
    },
    plan: {
      not_found: 'You do not have a plan yet.',
      item_not_found: 'Plan item not found.',
      already_exists: 'You already have a plan.',
      slug_taken: 'A phase with this identifier already exists.',
      invalid_date_range: 'The end date cannot be before the start date.',
      entry_requires_hours_and_kind: 'Phase entries need hours and a kind.',
      phase_id_required: 'Choose the phase for this entry.',
      phase_id_not_allowed: 'Only phase entries can have a phase.',
      entry_cannot_change_phase: 'An entry cannot move to another phase.',
    },
    community: {
      publication_not_found: 'Publication not found.',
    },
    validation: {
      invalid: 'Some fields are invalid.',
    },
    request: {
      invalid_body: 'The request could not be read. Try again.',
      too_large: 'The request is too large.',
    },
    server: {
      internal: 'Internal server error. Try again.',
    },
    network: {
      unreachable: 'Could not reach the server. Check that it is running.',
    },
    response: {
      invalid: 'The server sent an unexpected response.',
    },
  },
  issue: {
    required: 'Required field',
    invalid_type: 'Invalid type of value',
    invalid_value: 'Invalid value',
    invalid_format: 'Invalid format',
    invalid_range: 'Value out of the allowed range',
    too_short: 'Value too short',
    too_long: 'Value too long',
    unknown_field: 'Unknown field',
    duplicate: 'Duplicate value',
    conflict: 'Value conflicts with another',
    empty: 'Cannot be empty',
  },
  context: {
    loadGamesFailed: 'Could not load games.',
    syncFailed: 'Could not update platforms.',
    syncUnknownFailure: 'unknown failure',
    syncPlatformFailure: '{platform}: {reason}',
    syncJoiner: ' · ',
  },
} satisfies Shape<typeof errorsPtBR>;
