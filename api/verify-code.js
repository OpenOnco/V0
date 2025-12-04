export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  // Get the verification codes store
  const verificationCodes = global.verificationCodes;

  if (!verificationCodes) {
    return res.status(400).json({ error: 'No verification codes found. Please request a new code.' });
  }

  const storedData = verificationCodes.get(email.toLowerCase());

  if (!storedData) {
    return res.status(400).json({ error: 'No verification code found for this email. Please request a new code.' });
  }

  // Check if code is expired (10 minutes)
  if (Date.now() - storedData.timestamp > 10 * 60 * 1000) {
    verificationCodes.delete(email.toLowerCase());
    return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
  }

  // Check attempts (max 5)
  if (storedData.attempts >= 5) {
    verificationCodes.delete(email.toLowerCase());
    return res.status(400).json({ error: 'Too many attempts. Please request a new code.' });
  }

  // Increment attempts
  storedData.attempts += 1;

  // Check if code matches
  if (storedData.code !== code) {
    const remaining = 5 - storedData.attempts;
    return res.status(400).json({ 
      error: `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` 
    });
  }

  // Success! Remove the code so it can't be reused
  const vendor = storedData.vendor;
  verificationCodes.delete(email.toLowerCase());

  return res.status(200).json({ 
    success: true, 
    message: 'Email verified successfully',
    vendor 
  });
}
