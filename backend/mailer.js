const { EmailClient } = require("@azure/communication-email");

const client = new EmailClient(process.env.ACS_CONNECTION_STRING);
const FROM_ADDRESS = process.env.EMAIL_FROM;

// Azure Communication Services returns HTTP 429 when our sending quota is used up.
function isEmailRateLimitError(err) {
  if (!err) return false;
  if (err.rateLimited) return true;
  if (err.statusCode === 429 || err.status === 429) return true;
  if (err.code === "TooManyRequests") return true;
  return /\b429\b|too many requests|throttl|quota/i.test(err.message || "");
}

async function sendEmail(to, subject, html) {
  let result;
  try {
    const poller = await client.beginSend({
      senderAddress: FROM_ADDRESS,
      content: { subject, html },
      recipients: { to: [{ address: to }] },
    });
    result = await poller.pollUntilDone();
  } catch (err) {
    if (isEmailRateLimitError(err)) {
      const limited = new Error("Email sending is rate limited (429).");
      limited.rateLimited = true;
      limited.cause = err;
      throw limited;
    }
    throw err;
  }

  if (result.status !== "Succeeded") {
    throw new Error(`Email failed to send: ${result.status}`);
  }

  return result;
}

async function sendVerificationEmail(to, name, link) {
  await sendEmail(
    to,
    "Verify your email - BAEN Community",
    `
      <p>Hi ${name},</p>
      <p>Thanks for joining the BAEN Community. Please confirm your email address by clicking the link below:</p>
      <p><a href="${link}">Verify My Email</a></p>
      <p>This link will expire in 24 hours.</p>
    `,
  );
}

async function sendPasswordResetEmail(to, name, link) {
  await sendEmail(
    to,
    "Reset your password - BAEN Community",
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
    "Your BAEN Community login code",
    `
      <p>Hi ${name},</p>
      <p>Your login code is:</p>
      <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${code}</p>
      <p>This code will expire in 10 minutes. If you did not try to log in, you can safely ignore this email.</p>
    `,
  );
}

module.exports = {
  isEmailRateLimitError,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendMfaCodeEmail,
};
