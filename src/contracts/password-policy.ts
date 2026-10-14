export const PASSWORD_POLICY = {
  MIN_LENGTH: 8,
  /** The auth provider's hard ceiling; guards hash cost, not password quality. */
  MAX_LENGTH: 1024,
  UPPERCASE: /[A-Z]/,
  LOWERCASE: /[a-z]/,
  NUMBER: /[0-9]/,
} as const;
