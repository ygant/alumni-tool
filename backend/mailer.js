const { EmailClient } = require("@azure/communication-email");

const client = new EmailClient(process.env.ACS_CONNECTION_STRING);
const FROM_ADDRESS = process.env.EMAIL_FROM;

async function sendEmail(to, subject, html) {
  const poller = await client.beginSend({
    senderAddress: FROM_ADDRESS,
    content: { subject, html },
    recipients: { to: [{ address: to }] },
  });

  const result = await poller.pollUntilDone();

  if (result.status !== "Succeeded") {
    throw new Error(`Email failed to send: ${result.status}`);
  }

  return result;
}

async function sendVerificationEmail(to, name, link) {
  await sendEmail(
    to,
    "Verify your email - Alumni Center",
    `
      <p>Hi ${name},</p>
      <p>Thanks for signing up for the Alumni Center. Please confirm your email address by clicking the link below:</p>
      <p><a href="${link}">Verify My Email</a></p>
      <p>This link will expire in 24 hours.</p>
    `,
  );
}

async function sendPasswordResetEmail(to, name, link) {
  await sendEmail(
    to,
    "Reset your password - Alumni Center",
    `
      <p>Hi ${name},</p>
      <p>We received a request to reset your password. Click the link below to choose a new one:</p>
      <p><a href="${link}">Reset My Password</a></p>
      <p>This link will expire in 1 hour. If you did not request this, you can safely ignore this email.</p>
    `,
  );
}

async function sendMfaCodeEmail(to, name, code) {
  await sendEmail(
    to,
    "Your Alumni Center login code",
    `
      <p>Hi ${name},</p>
      <p>Your login code is:</p>
      <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${code}</p>
      <p>This code will expire in 10 minutes. If you did not try to log in, you can safely ignore this email.</p>
    `,
  );
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendMfaCodeEmail,
};
