import { AsyncLocalStorage } from "node:async_hooks";

type MailContext = { strict: boolean; failed: boolean };

const storage = new AsyncLocalStorage<MailContext>();

/** The mail context of the `auth.api` call currently running, if a caller asked
 * to observe it. Hooks outside such a call are lenient: they report and move on. */
export function currentMailContext(): MailContext | undefined {
  return storage.getStore();
}

/**
 * Runs an `auth.api` call and tells whether a verification email it triggered
 * failed to send. Better Auth swallows hook errors on sign-up (it logs and
 * carries on), so the hook records the failure here instead; `strict` makes the
 * hook rethrow as well, for calls whose whole purpose is sending the email.
 * Creating the user and its session never depends on the outcome.
 */
export async function trackMailDelivery<T>(
  options: { strict: boolean },
  operation: () => Promise<T>,
): Promise<{ result: T; failed: boolean }> {
  const context: MailContext = { strict: options.strict, failed: false };
  const result = await storage.run(context, operation);

  return { result, failed: context.failed };
}
