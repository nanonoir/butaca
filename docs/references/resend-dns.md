# Activate Butaca email with Resend DNS

Email delivery is enabled by the provider's DNS verification, not by an application flag. Once a valid runtime Resend key and the verified domain are available, the running application needs no code change, image rebuild, or redeployment just to activate email.

## DNS handoff

In Resend, open **Domains → butaca.lat → DNS records**. The configured sending region is **São Paulo (`sa-east-1`)**, Return-Path **`send`**, sender **`Butaca <no-reply@butaca.lat>`**.

| Type | DNS name | Value | Priority | TTL |
|---|---|---|---|---|
| MX | `send.butaca.lat` (usually enter `send`) | `feedback-smtp.sa-east-1.amazonses.com` | 10 | Auto |
| TXT | `send.butaca.lat` (usually enter `send`) | `v=spf1 include:amazonses.com ~all` | — | Auto |
| TXT | `resend._domainkey.butaca.lat` (usually enter `resend._domainkey`) | **Copy the entire DKIM public-key value from this domain's Resend DNS panel.** | — | Auto |

The MX/SPF values above follow the selected region and Return-Path. Use the domain's own Resend panel as the final authority before saving. The DKIM value is domain-specific and must not be invented or copied from documentation examples. It is a public DNS record, not an API key.

Do not change the domain's root MX records: this setup enables transactional sending, not inbound mail hosting. Do not add multiple SPF policies for the same `send` hostname; merge with an existing policy if needed. Some DNS panels automatically append `.butaca.lat`, so enter the relative name only in that case.

## Pending provider verification

1. The domain administrator adds the three records above (scheduled for 2026-10-15).
2. In Resend, request/check verification until the domain and sending records are verified.
3. Exercise registration verification and password recovery with a controlled recipient. Confirm receipt and successful single-use links under `https://butaca.lat` before declaring production email verified.

During development, a read-only metadata request (`GET /domains`) returned HTTP 401 without inspecting the response body or attempting a live send. This means the key may lack metadata read permissions (e.g., an API key restricted strictly to sending) rather than being invalid for email delivery. Consequently, the exact DKIM record and live domain status could not be queried via API. Obtain and copy the public DKIM record directly from the Resend domain panel. Real delivery remains unverified until DNS records are active and delivery is confirmed with a key authorized for sending. DNS propagation alone would not resolve an invalid key if one were configured, but the application code is verified and prepared to send automatically once DNS is active in a properly configured runtime environment, requiring no activation flags, image rebuild, or redeployment.

Application failures before verification must remain observable as sanitized provider errors, never simulated delivery success.
