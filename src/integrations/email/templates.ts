import type { EmailMessage } from "./mailer";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function render(input: {
  to: string;
  subject: string;
  greeting: string;
  intro: string;
  action: string;
  link: string;
  outro: string;
}): EmailMessage {
  const text = [
    input.greeting,
    "",
    input.intro,
    "",
    `${input.action}: ${input.link}`,
    "",
    input.outro,
  ].join("\n");

  const html = `<p>${escapeHtml(input.greeting)}</p>
<p>${escapeHtml(input.intro)}</p>
<p><a href="${escapeHtml(input.link)}">${escapeHtml(input.action)}</a></p>
<p>${escapeHtml(input.outro)}</p>`;

  return { to: input.to, subject: input.subject, html, text };
}

export function verificationEmail(input: {
  to: string;
  name: string;
  link: string;
}): EmailMessage {
  return render({
    to: input.to,
    subject: "Confirma tu correo en Butaca",
    greeting: `Hola ${input.name},`,
    intro: "Confirma tu dirección de correo para completar tu cuenta.",
    action: "Confirmar correo",
    link: input.link,
    outro: "Si no creaste una cuenta en Butaca, puedes ignorar este mensaje.",
  });
}

export function passwordResetEmail(input: {
  to: string;
  name: string;
  link: string;
}): EmailMessage {
  return render({
    to: input.to,
    subject: "Restablece tu contraseña de Butaca",
    greeting: `Hola ${input.name},`,
    intro: "Recibimos una solicitud para restablecer tu contraseña.",
    action: "Restablecer contraseña",
    link: input.link,
    outro:
      "Si no lo solicitaste, puedes ignorar este mensaje; tu contraseña no cambiará.",
  });
}
