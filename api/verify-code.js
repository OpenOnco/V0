import crypto from 'crypto';

// Verify the signed token and code
const verifyToken = (token, code) => {
  const secret = process.env.RESEND_API_KEY;
  
  const [data, signature] = token.split('.');
  if (!data || !signature) {
    return { valid: false, error: 'Invalid token format' };
  }
  
  // Verify signature
  const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('hex');
  if (signature !== expectedSig) {
    return { valid: false, error: 'Invalid token' };
  }
  
  // Decode payload
  const payload = JSON.parse(Buffer.from(data, 'base64').toString());
  
  // Check expiry
  if (Date.now() > payload.exp) {
    return { valid: false, error: 'Verification code has expired. Please request a new code.' };
  }
  
  // Check code
  if (payload.code !== code) {
    return { valid: false, error: 'Incorrect verification code' };
  }
  
  return { valid: true, email: payload.email };
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, code } = req.body;

  if (!token || !code) {
    return res.status(400).json({ error: 'Token and code are required' });
  }

  const result = verifyToken(token, code);
  
  if (!result.valid) {
    return res.status(400).json({ error: result.error });
  }

  return res.status(200).json({ 
    success: true, 
    message: 'Email verified successfully',
    email: result.email
  });
}
