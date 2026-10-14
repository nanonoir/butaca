export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "UnauthenticatedError";
  }
}

export class UserProfileNotProvisionedError extends Error {
  constructor() {
    super("User profile is not provisioned");
    this.name = "UserProfileNotProvisionedError";
  }
}

export class AuthProviderError extends Error {
  constructor() {
    super("Authentication provider operation failed");
    this.name = "AuthProviderError";
  }
}

export class AuthRateLimitedError extends Error {
  constructor() {
    super("Too many authentication attempts");
    this.name = "AuthRateLimitedError";
  }
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("Email is already registered");
    this.name = "EmailAlreadyRegisteredError";
  }
}

/** The reset or verification token is unknown, expired, or already used; the
 * provider does not distinguish them, and neither do we. */
export class InvalidAuthTokenError extends Error {
  constructor() {
    super("Authentication token is not valid");
    this.name = "InvalidAuthTokenError";
  }
}

export { ServiceUnavailableError } from "../../db/errors";

/** The provider rejected the password on length grounds. The product policy
 * already covers the lower bound, so this only fires for absurdly long input. */
export class WeakPasswordError extends Error {
  constructor() {
    super("Password does not meet the provider length limits");
    this.name = "WeakPasswordError";
  }
}

/** The account is fine but the verification email could not be sent (mail
 * provider unreachable or not yet configured). Retrying later is safe. */
export class VerificationEmailNotSentError extends Error {
  constructor() {
    super("Verification email could not be sent");
    this.name = "VerificationEmailNotSentError";
  }
}
