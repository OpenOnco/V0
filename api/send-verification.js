import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Simple in-memory store for verification codes
// In production, you might want to use Vercel KV or a database
const verificationCodes = new Map();

// Clean up expired codes (older than 10 minutes)
const cleanupExpiredCodes = () => {
  const now = Date.now();
  for (const [email, data] of verificationCodes.entries()) {
    if (now - data.timestamp > 10 * 60 * 1000) {
      verificationCodes.delete(email);
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, vendor, testName } = req.body;

  if (!email || !vendor) {
    return res.status(400).json({ error: 'Email and vendor are required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Clean up old codes
  cleanupExpiredCodes();

  // Store the code with timestamp
  verificationCodes.set(email.toLowerCase(), {
    code,
    vendor,
    timestamp: Date.now(),
    attempts: 0
  });

  // Make code available for verification endpoint
  global.verificationCodes = verificationCodes;

  try {
    await resend.emails.send({
      from: 'OpenOnco <noreply@openonco.org>',
      to: email,
      subject: `Your OpenOnco Verification Code: ${code}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2A63A4;">OpenOnco Email Verification</h2>
          <p>You're submitting data for <strong>${testName || 'a liquid biopsy test'}</strong> on behalf of <strong>${vendor}</strong>.</p>
          <p>Your verification code is:</p>
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1E4A7A;">${code}</span>
          </div>
          <p>This code expires in <strong>10 minutes</strong>.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">OpenOnco - Open-source liquid biopsy test information</p>
        </div>
      `
    });

    return res.status(200).json({ success: true, message: 'Verification code sent' });
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ error: 'Failed to send verification email' });
  }
}
