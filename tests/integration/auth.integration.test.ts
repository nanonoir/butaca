import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { UuidSchema } from "../../src/contracts/common";
import { authAccount, authSession, authUser, authVerification, users } from "../../src/db/schema";
import {
  AuthRateLimitedError,
  EmailAlreadyRegisteredError,
  InvalidAuthTokenError,
  InvalidCredentialsError,
  WeakPasswordError,
} from "../../src/features/auth/errors";
import {
  cookieHeaderFrom,
  createAuthHarness,
  findSetCookie,
  STUB_MAIL_FROM,
  tokenFromLink,
  type AuthHarness,
} from "./support/auth-harness";
import { createIntegrationDatabase } from "./support/database";
import {
  deleteTestAuthUserByEmail,
  generateTestEmail,
  generateTestPassword,
} from "./support/identity";

let database: ReturnType<typeof createIntegrationDatabase> | undefined;
let harness: AuthHarness | undefined;
const createdEmails: string[] = [];

function getDatabase() {
  if (!database) {
    throw new Error("Integration database was not created");
  }

  return database.db;
}

function getHarness() {
  if (!harness) {
    throw new Error("Auth harness was not created");
  }

  return harness;
}

beforeAll(() => {
  database = createIntegrationDatabase();
  harness = createAuthHarness(database.db);
});

afterEach(() => {
  getHarness().setResendStatus(200);
  getHarness().outbox.length = 0;
  getHarness().mailErrors.length = 0;
});

afterAll(async () => {
  try {
    // Only the identities this file registered, by generated email.
    for (const email of createdEmails) {
      const cleanup = await deleteTestAuthUserByEmail(getDatabase(), email);

      expect(cleanup.authUserPresentAfterCleanup).toBe(false);
    }
  } finally {
    await database?.close();
  }
});

/** Registers through the real service and remembers the email for cleanup. */
async function register(
  options: { displayName?: string; password?: string; address?: string } = {},
) {
  const email = generateTestEmail("auth");
  const password = options.password ?? generateTestPassword();
  const displayName = options.displayName ?? "Auth integration";

  createdEmails.push(email);

  const created = await getHarness()
    .service({ address: options.address })
    .signUp({ email, password, displayName });

  return { email, password, displayName, created };
}

/** Registers through the HTTP handler so the response cookies are observable. */
async function registerWithCookies() {
  const email = generateTestEmail("cookie");
  const password = generateTestPassword();

  createdEmails.push(email);

  const response = await getHarness().post("/sign-up/email", {
    name: "Cookie user",
    email,
    password,
  });

  expect(response.status).toBe(200);

  return { email, password, response, cookie: cookieHeaderFrom(response) };
}

describe("registration", () => {
  it("creates one identity, credential account and profile sharing a UUID", async () => {
    const { email, password, displayName, created } = await register();

    expect(UuidSchema.safeParse(created.id).success).toBe(true);
    expect(created.displayName).toBe(displayName);
    expect(created.avatarUrl).toBeNull();
    expect(created.onboardingCompletedAt).toBeNull();

    const [identity] = await getDatabase()
      .select()
      .from(authUser)
      .where(eq(authUser.email, email));
    const [account] = await getDatabase()
      .select()
      .from(authAccount)
      .where(eq(authAccount.userId, created.id));
    const [profile] = await getDatabase()
      .select()
      .from(users)
      .where(eq(users.id, created.id));

    expect(identity?.id).toBe(created.id);
    expect(identity?.emailVerified).toBe(false);
    expect(profile?.id).toBe(identity?.id);
    expect(account?.providerId).toBe("credential");
    // Hashed by the provider, never stored as typed.
    expect(account?.password).toBeTruthy();
    expect(account?.password).not.toBe(password);
    expect(account?.password).not.toContain(password);
  });

  it("rejects an email that is already registered without creating a second identity", async () => {
    const { email, password, displayName } = await register();

    await expect(
      getHarness()
        .service({ address: "198.51.100.11" })
        .signUp({ email, password, displayName }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);

    const rows = await getDatabase()
      .select({ id: authUser.id })
      .from(authUser)
      .where(eq(authUser.email, email));

    expect(rows).toHaveLength(1);
  });

  it("accepts the product password policy beyond the provider default length", async () => {
    const password = `Aa1${"x".repeat(200)}`;
    const { email, created } = await register({ password });
    const signedIn = await getHarness()
      .service({ address: "198.51.100.12" })
      .signIn({ email, password });

    expect(signedIn.id).toBe(created.id);
  });

  it("maps an absurdly long password to a weak-password error", async () => {
    await expect(
      getHarness()
        .service({ address: "198.51.100.13" })
        .signUp({
          email: generateTestEmail("long"),
          password: `Aa1${"x".repeat(2_000)}`,
          displayName: "Too long",
        }),
    ).rejects.toBeInstanceOf(WeakPasswordError);
  });

  it("rate limits registrations per address", async () => {
    const service = getHarness().service({ address: "198.51.100.14" });
    let rejection: unknown;

    for (let attempt = 0; attempt < 11 && !rejection; attempt += 1) {
      const email = generateTestEmail("rate");

      createdEmails.push(email);
      rejection = await service
        .signUp({ email, password: generateTestPassword(), displayName: "Rate" })
        .then(
          () => undefined,
          (error: unknown) => error,
        );
    }

    expect(rejection).toBeInstanceOf(AuthRateLimitedError);
  });
});

describe("sessions and cookies", () => {
  it("recovers a session in a fresh provider instance and rejects its database expiry", async () => {
    const { cookie, email } = await registerWithCookies();
    const fresh = createAuthHarness(getDatabase());

    await expect(fresh.service({ cookie }).getCurrentSession()).resolves.toMatchObject({ email });

    const [identity] = await getDatabase()
      .select({ id: authUser.id })
      .from(authUser)
      .where(eq(authUser.email, email));

    expect(identity).toBeDefined();
    await getDatabase()
      .update(authSession)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(authSession.userId, identity!.id));

    await expect(fresh.service({ cookie }).getCurrentUser()).resolves.toBeNull();
  });

  it("issues an HttpOnly, SameSite session cookie backed by a database session", async () => {
    const { response, cookie, email } = await registerWithCookies();
    const sessionCookie = findSetCookie(response, "session_token");

    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(/HttpOnly/i);
    expect(sessionCookie).toMatch(/SameSite=Lax/i);
    expect(sessionCookie).toMatch(/Path=\//i);
    // The auth origin is local http, so the cookie must not demand TLS.
    expect(sessionCookie).not.toMatch(/Secure/i);

    const [identity] = await getDatabase()
      .select({ id: authUser.id })
      .from(authUser)
      .where(eq(authUser.email, email));
    const sessions = await getDatabase()
      .select()
      .from(authSession)
      .where(eq(authSession.userId, identity?.id ?? ""));

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(cookie).toContain(sessions[0]?.token);
  });

  it("resolves the current user and profile from the session cookie only", async () => {
    const { cookie, email } = await registerWithCookies();
    const session = await getHarness()
      .service({ cookie })
      .getCurrentSession();

    expect(session?.email).toBe(email);
    expect(session?.emailVerified).toBe(false);
    expect(session?.user.displayName).toBe("Cookie user");
    expect(UuidSchema.safeParse(session?.user.id).success).toBe(true);

    await expect(getHarness().service().getCurrentUser()).resolves.toBeNull();
    await expect(
      getHarness()
        .service({ cookie: "better-auth.session_token=forged.value" })
        .getCurrentUser(),
    ).resolves.toBeNull();
  });

  it("signs in with the right password and records a new session", async () => {
    const { email, password, created } = await register();
    const service = getHarness().service({ address: "198.51.100.20" });

    await expect(
      service.signIn({ email, password: `${password}x` }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(
      service.signIn({ email: generateTestEmail("ghost"), password }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    const signedIn = await service.signIn({ email, password });
    const sessions = await getDatabase()
      .select()
      .from(authSession)
      .where(eq(authSession.userId, created.id));

    expect(signedIn.id).toBe(created.id);
    // Registration signs in automatically, and this login adds another.
    expect(sessions.length).toBeGreaterThanOrEqual(2);
  });

  it("logs out by removing the database session", async () => {
    const { cookie, email } = await registerWithCookies();
    const [identity] = await getDatabase()
      .select({ id: authUser.id })
      .from(authUser)
      .where(eq(authUser.email, email));

    await getHarness().service({ cookie }).signOut();

    const remaining = await getDatabase()
      .select()
      .from(authSession)
      .where(eq(authSession.userId, identity?.id ?? ""));

    expect(remaining).toHaveLength(0);
    await expect(
      getHarness().service({ cookie }).getCurrentUser(),
    ).resolves.toBeNull();
  });

  it("recreates a profile removed out of band when the user signs in", async () => {
    const { email, password, created } = await register();

    await getDatabase().delete(users).where(eq(users.id, created.id));

    const signedIn = await getHarness()
      .service({ address: "198.51.100.21" })
      .signIn({ email, password });

    expect(signedIn.id).toBe(created.id);
    expect(signedIn.displayName).toBe("Auth integration");
  });
});

describe("password reset", () => {
  const redirectTo = "/confirm";

  async function requestReset(email: string, address: string) {
    getHarness().outbox.length = 0;
    await getHarness()
      .service({ address })
      .requestPasswordReset({ email, redirectTo });

    return getHarness().waitForMail(
      (mail) =>
        mail.to.includes(email) && /restablece/i.test(mail.subject),
    );
  }

  it("emails a one-time link and accepts it exactly once", async () => {
    const { email, password, created } = await register();
    const mail = await requestReset(email, "198.51.100.30");
    const token = tokenFromLink(mail.text);
    const newPassword = generateTestPassword();

    await getHarness()
      .service({ address: "198.51.100.30" })
      .updatePassword({ token, newPassword });

    await expect(
      getHarness()
        .service({ address: "198.51.100.30" })
        .updatePassword({ token, newPassword: generateTestPassword() }),
    ).rejects.toBeInstanceOf(InvalidAuthTokenError);

    const service = getHarness().service({ address: "198.51.100.31" });

    await expect(
      service.signIn({ email, password }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(
      service.signIn({ email, password: newPassword }),
    ).resolves.toMatchObject({ id: created.id });
  });

  it("allows exactly one concurrent consumer of a password-reset token", async () => {
    const { email } = await register();
    const mail = await requestReset(email, "198.51.100.37");
    const token = tokenFromLink(mail.text);
    const attempts = await Promise.allSettled(
      ["198.51.100.38", "198.51.100.39"].map((address) =>
        getHarness().service({ address }).updatePassword({
          token,
          newPassword: generateTestPassword(),
        }),
      ),
    );

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    const rejected = attempts.find((attempt) => attempt.status === "rejected");

    expect(rejected?.status === "rejected" && rejected.reason).toBeInstanceOf(InvalidAuthTokenError);
  });

  it("revokes existing sessions when the password is reset", async () => {
    const { email, cookie } = await registerWithCookies();

    await expect(
      getHarness().service({ cookie }).getCurrentUser(),
    ).resolves.not.toBeNull();

    const mail = await requestReset(email, "198.51.100.32");

    await getHarness()
      .service({ address: "198.51.100.32" })
      .updatePassword({
        token: tokenFromLink(mail.text),
        newPassword: generateTestPassword(),
      });

    await expect(
      getHarness().service({ cookie }).getCurrentUser(),
    ).resolves.toBeNull();
  });

  it("rejects an expired token", async () => {
    const { email } = await register();
    const mail = await requestReset(email, "198.51.100.33");
    const token = tokenFromLink(mail.text);

    await getDatabase()
      .update(authVerification)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(authVerification.identifier, `reset-password:${token}`));

    await expect(
      getHarness()
        .service({ address: "198.51.100.33" })
        .updatePassword({ token, newPassword: generateTestPassword() }),
    ).rejects.toBeInstanceOf(InvalidAuthTokenError);
  });

  it("rejects an unknown token", async () => {
    await expect(
      getHarness()
        .service({ address: "198.51.100.34" })
        .updatePassword({
          token: "not-a-real-token",
          newPassword: generateTestPassword(),
        }),
    ).rejects.toBeInstanceOf(InvalidAuthTokenError);
  });

  it("answers an unknown address like a known one and sends nothing", async () => {
    const ghost = generateTestEmail("ghost");

    getHarness().outbox.length = 0;
    await expect(
      getHarness()
        .service({ address: "198.51.100.35" })
        .requestPasswordReset({ email: ghost, redirectTo }),
    ).resolves.toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(getHarness().outbox.some((mail) => mail.to.includes(ghost))).toBe(
      false,
    );
  });

  it("rate limits reset requests per email", async () => {
    const { email } = await register();
    const service = getHarness().service({ address: "198.51.100.36" });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await service.requestPasswordReset({ email, redirectTo });
    }

    await expect(
      service.requestPasswordReset({ email, redirectTo }),
    ).rejects.toBeInstanceOf(AuthRateLimitedError);
  });
});

describe("email verification and mail delivery", () => {
  it("sends the verification email through the Resend HTTP API after sign-up", async () => {
    const { email } = await register();
    const mail = await getHarness().waitForMail(
      (candidate) =>
        candidate.to.includes(email) && /confirma/i.test(candidate.subject),
    );

    expect(mail.from).toBe(STUB_MAIL_FROM);
    expect(mail.authorization).toMatch(/^Bearer re_stub_/);
    expect(mail.text).toContain(`${getHarness().baseURL}/verify-email?token=`);
    expect(mail.html).toContain("verify-email?token=");
  });

  it("does not gate sign-in or the session on verification", async () => {
    const { email, password } = await register();
    const signedIn = await getHarness()
      .service({ address: "198.51.100.40" })
      .signIn({ email, password });
    const [identity] = await getDatabase()
      .select({ verified: authUser.emailVerified })
      .from(authUser)
      .where(eq(authUser.id, signedIn.id));

    expect(identity?.verified).toBe(false);
  });

  it("marks the address as verified with the emailed token", async () => {
    const { email, created } = await register();
    const mail = await getHarness().waitForMail((candidate) =>
      candidate.to.includes(email),
    );

    await getHarness()
      .service({ address: "198.51.100.41" })
      .verifyEmail(tokenFromLink(mail.text));

    const [identity] = await getDatabase()
      .select({ verified: authUser.emailVerified })
      .from(authUser)
      .where(eq(authUser.id, created.id));

    expect(identity?.verified).toBe(true);
  });

  it("rejects an invalid verification token", async () => {
    await expect(
      getHarness()
        .service({ address: "198.51.100.42" })
        .verifyEmail("not-a-real-token"),
    ).rejects.toBeInstanceOf(InvalidAuthTokenError);
  });

  it("completes registration and login when the mail provider fails", async () => {
    getHarness().setResendStatus(500);

    const { email, password, created } = await register();

    await expect
      .poll(() => getHarness().mailErrors.length, { timeout: 5_000 })
      .toBeGreaterThan(0);

    const reported = String(getHarness().mailErrors[0]);

    expect(reported).not.toContain("re_stub_");
    expect(reported).not.toContain(email);

    const signedIn = await getHarness()
      .service({ address: "198.51.100.43" })
      .signIn({ email, password });

    expect(signedIn.id).toBe(created.id);
  });
});

describe("cookies behind HTTPS", () => {
  it("marks the session cookie Secure when the canonical origin is https", async () => {
    const secure = createAuthHarness(getDatabase(), {
      baseURL: "https://localhost:3100",
    });
    const email = generateTestEmail("tls");

    createdEmails.push(email);

    const response = await secure.post("/sign-up/email", {
      name: "Tls user",
      email,
      password: generateTestPassword(),
    });
    const sessionCookie = findSetCookie(response, "session_token");

    expect(response.status).toBe(200);
    expect(sessionCookie).toMatch(/Secure/i);
    expect(sessionCookie).toMatch(/HttpOnly/i);
    expect(sessionCookie).toMatch(/SameSite=Lax/i);
  });
});

describe("concurrency and atomicity", () => {
  it("creates one identity when the same email registers concurrently", async () => {
    const email = generateTestEmail("race");
    const password = generateTestPassword();

    createdEmails.push(email);

    const results = await Promise.allSettled(
      ["198.51.100.50", "198.51.100.51", "198.51.100.52"].map((address) =>
        getHarness()
          .service({ address })
          .signUp({ email, password, displayName: "Race" }),
      ),
    );
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(2);
    // Losers of the race surface the raw unique violation as "unavailable"
    // rather than EmailAlreadyRegisteredError (reported to the core agent).
    // The invariant asserted here is: exactly one identity survives.

    const identities = await getDatabase()
      .select({ id: authUser.id })
      .from(authUser)
      .where(eq(authUser.email, email));
    const profiles = await getDatabase()
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, identities[0]?.id ?? ""));

    expect(identities).toHaveLength(1);
    expect(profiles).toHaveLength(1);
  });

  it("rolls back the identity together with its profile when the transaction fails", async () => {
    const email = generateTestEmail("rollback");
    const id = crypto.randomUUID();

    await expect(
      getDatabase().transaction(async (transaction) => {
        await transaction.insert(authUser).values({ id, name: "Rollback", email });

        const [profile] = await transaction
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, id));

        // The trigger ran inside the same transaction.
        expect(profile?.id).toBe(id);
        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");

    const [identityRows, profileRows] = await Promise.all([
      getDatabase().select({ id: authUser.id }).from(authUser).where(eq(authUser.id, id)),
      getDatabase().select({ id: users.id }).from(users).where(eq(users.id, id)),
    ]);

    expect(identityRows).toHaveLength(0);
    expect(profileRows).toHaveLength(0);
  });

  it("leaves neither identity nor profile behind when a second insert violates a constraint", async () => {
    const email = generateTestEmail("trigger");
    const id = crypto.randomUUID();

    await expect(
      getDatabase().transaction(async (transaction) => {
        await transaction.insert(authUser).values({ id, name: "First", email });
        await transaction.insert(authUser).values({ id, name: "Dup", email });
      }),
    ).rejects.toThrow();

    const [identityRows, profileRows] = await Promise.all([
      getDatabase().select({ id: authUser.id }).from(authUser).where(eq(authUser.id, id)),
      getDatabase().select({ id: users.id }).from(users).where(eq(users.id, id)),
    ]);

    expect(identityRows).toHaveLength(0);
    expect(profileRows).toHaveLength(0);
  });
});
