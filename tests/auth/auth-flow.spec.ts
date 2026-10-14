import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { authUser } from "../../src/db/schema";
import { createStandaloneTestDatabase } from "../integration/support/standalone-database";
import { linkFrom, mailsTo, setResendStatus, waitForMail } from "../support/outbox";

import {
  cleanupOnboardingTestUser,
  createOnboardingTestUser,
} from "../onboarding/onboarding-test-support";
import {
  OnboardingPage,
  type OnboardingTestUser,
} from "../onboarding/onboarding-page";

let createdUser: OnboardingTestUser | undefined;

test.afterEach(async () => {
  if (createdUser) {
    await cleanupOnboardingTestUser(createdUser.email);
    createdUser = undefined;
  }
});

/** Real backend, real cookies: the browser context is the cookie jar. */
test.describe("Authentication session over HTTP", () => {
  test("registers, keeps an HttpOnly session, rejects bad credentials and logs out", async ({
    request,
    baseURL,
  }) => {
    createdUser = createOnboardingTestUser();
    const { username, email, password } = createdUser;

    const registered = await request.post("/api/register", {
      data: { username, email, password, confirmPassword: password },
    });

    expect(registered.status()).toBe(201);
    const body = (await registered.json()) as {
      data: { id: string; username: string; email: string };
    };

    expect(body.data.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(body.data).toMatchObject({ username, email });
    expect(JSON.stringify(body)).not.toContain(password);

    const cookies = await request.storageState();
    const session = cookies.cookies.find((cookie) =>
      cookie.name.includes("session_token"),
    );

    expect(session).toBeDefined();
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Lax");
    expect(session?.secure).toBe(new URL(baseURL ?? "").protocol === "https:");

    // Registration signed the user in: an authenticated route works.
    const onboarding = await request.get("/onboarding", { maxRedirects: 0 });

    expect(onboarding.status()).toBe(200);

    const wrong = await request.post("/api/login", {
      data: { email, password: `${password}x` },
    });

    expect(wrong.status()).toBe(401);
    expect(await wrong.json()).toMatchObject({
      error: { code: "INVALID_CREDENTIALS" },
    });

    const duplicate = await request.post("/api/register", {
      data: { username, email, password, confirmPassword: password },
    });

    expect(duplicate.status()).toBe(409);
    expect(await duplicate.json()).toMatchObject({
      error: { code: "EMAIL_ALREADY_REGISTERED" },
    });

    expect((await request.post("/api/logout")).status()).toBe(204);

    const afterLogout = await request.get("/onboarding", { maxRedirects: 0 });

    expect([307, 308]).toContain(afterLogout.status());
    expect(afterLogout.headers().location).toContain("/login");

    const login = await request.post("/api/login", {
      data: { email, password },
    });

    expect(login.status()).toBe(200);
    expect(((await login.json()) as { data: { id: string } }).data.id).toBe(
      body.data.id,
    );
  });

  test("answers a reset request identically for known and unknown addresses", async ({
    request,
  }) => {
    createdUser = createOnboardingTestUser();
    const { username, email, password } = createdUser;

    await request.post("/api/register", {
      data: { username, email, password, confirmPassword: password },
    });

    const known = await request.post("/api/forgot-password", {
      data: { email },
    });
    const unknown = await request.post("/api/forgot-password", {
      data: { email: `butaca-test-ghost-${crypto.randomUUID()}@example.test` },
    });

    expect(known.status()).toBe(204);
    expect(unknown.status()).toBe(204);
  });

  test("refuses a reset with an unknown token using the invalid-link envelope", async ({
    request,
  }) => {
    const password = `Reset-${crypto.randomUUID()}A1`;
    const response = await request.post("/api/reset-password", {
      data: { token: "not-a-real-token", newPassword: password, confirmPassword: password },
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "INVALID_RESET_LINK" },
    });
  });

  test("persists the session across onboarding, logout and a fresh login in the browser", async ({
    page,
  }) => {
    createdUser = createOnboardingTestUser();
    const user = createdUser;
    const onboarding = new OnboardingPage(page);

    await onboarding.register(user);
    await onboarding.selectMinimumGenres();
    await onboarding.searchAndSelectMinimumMovies("a");
    await onboarding.complete();

    // The cookie, not client state, keeps the user in: a reload stays signed in.
    await page.reload();
    await expect(page).toHaveURL(/\/$/);

    expect((await page.request.post("/api/logout")).status()).toBe(204);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel("Correo electrónico").fill(user.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    // Onboarding was completed, so the guard sends the user home, not back.
    await expect(page).toHaveURL(/\/$/);
  });

  test("keeps the health endpoint independent from the session", async ({
    request,
  }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ data: { status: "ok" } });
  });
});

async function isEmailVerified(email: string): Promise<boolean | undefined> {
  const connection = createStandaloneTestDatabase();

  try {
    const [row] = await connection.db
      .select({ verified: authUser.emailVerified })
      .from(authUser)
      .where(eq(authUser.email, email));

    return row?.verified;
  } finally {
    await connection.close();
  }
}

// Real app, real Better Auth, real PostgreSQL; only Resend is answered by the
// test preload, which records each message in BUTACA_TEST_OUTBOX_DIR. Serial
// because the failure test flips a provider-wide switch.
test.describe("Email flows through the test outbox", () => {
  test.describe.configure({ mode: "serial" });

  test.afterEach(() => {
    setResendStatus(null);
  });

  test("delivers a verification link that verifies without ever blocking login", async ({
    request,
  }) => {
    createdUser = createOnboardingTestUser();
    const { username, email, password } = createdUser;

    expect(
      (
        await request.post("/api/register", {
          data: { username, email, password, confirmPassword: password },
        })
      ).status(),
    ).toBe(201);

    const mail = await waitForMail(email, /confirma/i);

    expect(await isEmailVerified(email)).toBe(false);

    // Unverified accounts sign in normally.
    await request.post("/api/logout");
    expect(
      (await request.post("/api/login", { data: { email, password } })).status(),
    ).toBe(200);

    const verify = await request.get(linkFrom(mail), { maxRedirects: 0 });

    expect([302, 303, 307, 308]).toContain(verify.status());
    await expect.poll(() => isEmailVerified(email)).toBe(true);

    // Following a verification link again, or a bogus one, never errors out.
    const bogus = await request.get("/verify-email?token=not-a-real-token", {
      maxRedirects: 0,
    });

    expect([302, 303, 307, 308]).toContain(bogus.status());
  });

  test("resets a password from the emailed link exactly once", async ({
    page,
    request,
  }) => {
    createdUser = createOnboardingTestUser();
    const { username, email, password } = createdUser;
    const newPassword = `Changed-${crypto.randomUUID()}A1`;

    await request.post("/api/register", {
      data: { username, email, password, confirmPassword: password },
    });
    await request.post("/api/logout");

    expect(
      (await request.post("/api/forgot-password", { data: { email } })).status(),
    ).toBe(204);

    const link = linkFrom(await waitForMail(email, /restablece/i));

    await page.goto(link);
    // Hydration removes the credential from the address bar while the form
    // retains it in memory for the request.
    await expect(page).toHaveURL(/\/reset-password$/);
    await page
      .getByLabel("Nueva contraseña", { exact: true })
      .fill(newPassword);
    await page
      .getByLabel("Confirmar nueva contraseña", { exact: true })
      .fill(newPassword);
    await page.getByRole("button", { name: "Actualizar contraseña" }).click();
    await expect(page).toHaveURL(/\/login/);

    const token = new URL(link).searchParams.get("token") ?? "";
    const reuse = await request.post("/api/reset-password", {
      data: { token, newPassword, confirmPassword: newPassword },
    });

    expect(reuse.status()).toBe(400);
    expect(await reuse.json()).toMatchObject({
      error: { code: "INVALID_RESET_LINK" },
    });

    expect(
      (await request.post("/api/login", { data: { email, password } })).status(),
    ).toBe(401);
    expect(
      (
        await request.post("/api/login", {
          data: { email, password: newPassword },
        })
      ).status(),
    ).toBe(200);
  });

  test("registers and signs in while the mail provider is failing", async ({
    request,
  }) => {
    setResendStatus(500);
    createdUser = createOnboardingTestUser();
    const { username, email, password } = createdUser;

    expect(
      (
        await request.post("/api/register", {
          data: { username, email, password, confirmPassword: password },
        })
      ).status(),
    ).toBe(201);

    // The provider was reached and refused; the account still works.
    await expect.poll(() => mailsTo(email).length).toBeGreaterThan(0);
    expect(mailsTo(email).every((mail) => mail.status === 500)).toBe(true);

    await request.post("/api/logout");
    expect(
      (await request.post("/api/login", { data: { email, password } })).status(),
    ).toBe(200);
  });
});

test.describe("Cross-site requests", () => {
  const foreign = { origin: "https://evil.example" };

  test("login, register and logout from a foreign origin issue and revoke no session", async ({
    request,
  }) => {
    createdUser = createOnboardingTestUser();
    const { username, email, password } = createdUser;

    const registered = await request.post("/api/register", {
      data: { username, email, password, confirmPassword: password },
    });

    expect(registered.status()).toBe(201);
    await request.post("/api/logout");

    const login = await request.post("/api/login", {
      data: { email, password },
      headers: foreign,
    });

    expect(login.status()).toBeGreaterThanOrEqual(400);
    expect((await request.storageState()).cookies).toHaveLength(0);

    const forgedRegister = await request.post("/api/register", {
      data: {
        username: `${username}x`.slice(0, 20),
        email: `x-${email}`,
        password,
        confirmPassword: password,
      },
      headers: foreign,
    });

    expect(forgedRegister.status()).toBeGreaterThanOrEqual(400);
    expect((await request.storageState()).cookies).toHaveLength(0);

    // A same-origin login establishes the session a forged logout targets.
    expect(
      (await request.post("/api/login", { data: { email, password } })).status(),
    ).toBe(200);

    const logout = await request.post("/api/logout", { headers: foreign });

    expect(logout.status()).toBeGreaterThanOrEqual(400);
    expect((await request.get("/api/likes")).status()).toBe(200);
  });
});
