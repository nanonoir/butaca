import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type OutboxMail = {
  to: string[];
  from: string;
  subject: string;
  text: string;
  html: string;
  status: number;
};

/** Directory the test-only network preload writes accepted Resend requests to.
 * The server and the specs must be started with the same value. */
function outboxDir(): string {
  const dir = process.env.BUTACA_TEST_OUTBOX_DIR;

  if (!dir) {
    throw new Error(
      "BUTACA_TEST_OUTBOX_DIR is required for email flows (the Next server " +
        "must run with tests/support/network-preload.mjs)",
    );
  }

  return dir;
}

function readOutbox(): OutboxMail[] {
  const dir = outboxDir();

  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir)
    .filter((name) => name.endsWith(".json") && !name.startsWith("."))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(dir, name), "utf8")) as OutboxMail);
}

/** Polls for a message to `email` whose subject matches. Never prints it: the
 * body holds one-time links. */
export async function waitForMail(
  email: string,
  subject: RegExp,
  timeoutMs = 15_000,
): Promise<OutboxMail> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const found = readOutbox()
      .reverse()
      .find((mail) => mail.to.includes(email) && subject.test(mail.subject));

    if (found) {
      return found;
    }

    if (Date.now() > deadline) {
      throw new Error("Expected email did not reach the test outbox");
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export function mailsTo(email: string): OutboxMail[] {
  return readOutbox().filter((mail) => mail.to.includes(email));
}

/** The first link in the plain-text body (verification and reset mails carry
 * exactly one). */
export function linkFrom(mail: OutboxMail): string {
  const link = /https?:\/\/\S+/.exec(mail.text)?.[0];

  if (!link) {
    throw new Error("Email did not contain a link");
  }

  return link;
}

/** Makes the stubbed provider answer with `status` until `null` restores it. */
export function setResendStatus(status: number | null): void {
  const file = join(outboxDir(), "resend-status");

  if (status === null) {
    rmSync(file, { force: true });
  } else {
    writeFileSync(file, String(status));
  }
}
