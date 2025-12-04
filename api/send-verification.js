import { Resend } from 'resend';
import crypto from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

// Create a signed token containing the code
const createToken = (email, code) => {
  const secret = process.env.RESEND_API_KEY;
  const payload = {
    email: email.toLowerCase(),
    code,
    exp: Date.now() + 10 * 60 * 1000 // 10 minutes
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return `${data}.${signature}`;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, vendor, testName } = req.body;

  if (!email || !vendor) {
    return res.status(400).json({ error: 'Email and vendor are required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const token = createToken(email, code);

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

    return res.status(200).json({ success: true, token });
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ error: 'Failed to send verification email' });
  }
}
