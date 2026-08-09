// SongiSathi Ghotok — outbound email.
//
// No SMTP transport is wired up yet, so in development every message is written
// to the server console (the verification / reset link is printed in full so you
// can click through while testing). To go live, install a transport such as
// `nodemailer`, implement `deliver()` below, and set MAIL_TRANSPORT=smtp.

const APP_NAME = 'SongiSathi';
const FROM = process.env.MAIL_FROM || 'SongiSathi <no-reply@songisathi.app>';
const TRANSPORT = (process.env.MAIL_TRANSPORT || 'console').toLowerCase();

// The web origin used to build clickable links in emails.
export const APP_URL = process.env.APP_URL || 'http://localhost:5173';

async function deliver({ to, subject, text }) {
  if (TRANSPORT === 'console') {
    console.log('\n──────── ✉  EMAIL (dev console transport) ────────');
    console.log(`From:    ${FROM}`);
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log('');
    console.log(text);
    console.log('──────────────────────────────────────────────────\n');
    return;
  }
  // e.g. SMTP via nodemailer — plug in here when ready.
  throw new Error(`Mail transport "${TRANSPORT}" is not implemented.`);
}

export function sendVerificationEmail({ to, fullName, token }) {
  const link = `${APP_URL}/verify-email?token=${token}`;
  const subject = `Confirm your ${APP_NAME} email address`;
  const text = [
    `Assalamu Alaikum ${fullName || ''},`.trim(),
    '',
    `Welcome to ${APP_NAME}. Please confirm your email address to activate all features:`,
    '',
    link,
    '',
    'This link expires in 24 hours. If you did not create this account, you can ignore this email.',
  ].join('\n');
  return deliver({ to, subject, text });
}

export function sendPasswordResetEmail({ to, fullName, token }) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  const subject = `Reset your ${APP_NAME} password`;
  const text = [
    `Assalamu Alaikum ${fullName || ''},`.trim(),
    '',
    `We received a request to reset the password for your ${APP_NAME} account. Use the link below to choose a new password:`,
    '',
    link,
    '',
    'This link expires in 1 hour. If you did not request this, you can safely ignore this email — your password will not change.',
  ].join('\n');
  return deliver({ to, subject, text });
}
