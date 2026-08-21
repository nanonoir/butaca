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
