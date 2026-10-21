/*
  Stable API error codes. This file has no imports (not even node ones) so the
  frontend can import the types and the code list to map codes to translations.
*/

export const API_ERROR_CODES = [
  'auth.unauthenticated',
  'auth.invalid_credentials',
  'auth.invalid_username',
  'auth.username_taken',
  'auth.password_too_short',
  'auth.current_password_incorrect',
  'auth.display_name_required',
  'sync.unsupported_platform',
  'sync.not_configured',
  'sync.link_not_verified',
  'sync.identifier_required',
  'sync.steam_id_required',
  'sync.steam_profile_not_found',
  'sync.steam_profile_unreadable',
  'sync.steam_profile_private',
  'sync.steam_key_rejected',
  'sync.psn_profile_not_found',
  'sync.ra_user_not_found',
  'sync.verification_not_linked',
  'sync.verification_no_pending_code',
  'sync.verification_code_not_found',
  'sync.steam_service_not_configured',
  'sync.ra_service_not_configured',
  'sync.psn_service_not_configured',
  'sync.psn_credential_expired',
  'game.not_found',
  'collections.name_required',
  'plan.not_found',
  'plan.item_not_found',
  'plan.already_exists',
  'plan.slug_taken',
  'plan.invalid_date_range',
  'plan.entry_requires_hours_and_kind',
  'plan.phase_id_required',
  'plan.phase_id_not_allowed',
  'plan.entry_cannot_change_phase',
  'community.publication_not_found',
  'validation.invalid',
  'request.invalid_body',
  'request.too_large',
  'server.internal',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const VALIDATION_ISSUE_CODES = [
  'required',
  'invalid_type',
  'invalid_value',
  'invalid_format',
  'invalid_range',
  'too_short',
  'too_long',
  'unknown_field',
  'duplicate',
  'conflict',
  'empty',
] as const;

export type ValidationIssueCode = (typeof VALIDATION_ISSUE_CODES)[number];

/** Field-level detail attached to `validation.invalid` responses. */
export interface ApiErrorDetail {
  field: string;
  code: ValidationIssueCode;
}

/** JSON body of every error response. `error` is the English default message. */
export interface ApiErrorBody {
  error: string;
  code: ApiErrorCode;
  details?: ApiErrorDetail[];
}
