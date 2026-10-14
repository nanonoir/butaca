import { describe, expect, it, vi } from "vitest";

import { EmailDeliveryError, createResendMailer } from "../mailer";
import { passwordResetEmail, verificationEmail } from "../templates";

const message = { to: "a@example.test", subject: "s", html: "<p>h</p>", text: "t" };
const config = { apiKey: "re_test_key", from: "Butaca <no-reply@butaca.lat>" };

describe("createResendMailer", () => {
  it("posts the message to the Resend API with the bearer key", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 200 }));

    await createResendMailer(config, fetchMock).send(message);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer re_test_key");
    expect(JSON.parse(init?.body as string)).toMatchObject({
      from: config.from,
      to: [message.to],
      subject: "s",
    });
  });

  it("fails without leaking the key or recipient", async () => {
    const rejected = createResendMailer(
      config,
      vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 422 })),
    ).send(message);
    await expect(rejected).rejects.toThrow("status 422");

    const network = await createResendMailer(config, vi.fn<typeof fetch>().mockRejectedValue(new Error("re_test_key a@example.test")))
      .send(message)
      .catch((e: unknown) => e);
    expect(network).toBeInstanceOf(EmailDeliveryError);
    expect(String(network)).not.toContain("re_test_key");
    expect(String(network)).not.toContain("a@example.test");
  });

  it("refuses to send when not configured, without calling the network", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    await expect(createResendMailer({ apiKey: undefined, from: undefined }, fetchMock).send(message)).rejects.toThrow("not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("email templates", () => {
  it("escapes user-controlled names in HTML and keeps the link", () => {
    const email = verificationEmail({ to: "a@example.test", name: "<script>x</script>", link: "https://butaca.lat/verify-email?token=a&b=1" });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("token=a&amp;b=1");
    expect(email.text).toContain("https://butaca.lat/verify-email?token=a&b=1");
  });

  it("builds a reset email addressed to the recipient", () => {
    const email = passwordResetEmail({ to: "a@example.test", name: "Ana", link: "https://butaca.lat/r?token=t" });

    expect(email.to).toBe("a@example.test");
    expect(email.subject).toContain("contraseña");
  });
});
