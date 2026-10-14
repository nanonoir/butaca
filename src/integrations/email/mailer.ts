export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type Mailer = {
  send(message: EmailMessage): Promise<void>;
};

export type ResendConfig = {
  apiKey: string | undefined;
  from: string | undefined;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 10_000;

export class EmailDeliveryError extends Error {
  constructor(reason: string) {
    super(`Email delivery failed: ${reason}`);
    this.name = "EmailDeliveryError";
  }
}

/** Minimal Resend HTTP client. Errors carry only a status or a fixed reason:
 * never the key, the recipient or the message body. */
export function createResendMailer(
  config: ResendConfig,
  fetchImpl: typeof fetch = fetch,
): Mailer {
  return {
    async send(message) {
      if (!config.apiKey || !config.from) {
        throw new EmailDeliveryError("not configured");
      }

      let response: Response;

      try {
        response = await fetchImpl(RESEND_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: config.from,
            to: [message.to],
            subject: message.subject,
            html: message.html,
            text: message.text,
          }),
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
      } catch {
        throw new EmailDeliveryError("network");
      }

      if (!response.ok) {
        throw new EmailDeliveryError(`status ${response.status}`);
      }
    },
  };
}
