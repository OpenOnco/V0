import crypto from 'crypto';
import { withVercelLogging } from '../shared/logger/index.js';

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

export default withVercelLogging(async (req, res) => {
  const startTime = Date.now();

  if (req.method !== 'POST') {
    req.logger.info('Error response sent', { status: 405, durationMs: Date.now() - startTime });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, code } = req.body;

  // Log request (no sensitive data)
  req.logger.info('Verification code check received', {
    hasToken: !!token,
    hasCode: !!code
  });

  if (!token || !code) {
    req.logger.info('Error response sent', { status: 400, durationMs: Date.now() - startTime, errorType: 'validation' });
    return res.status(400).json({ error: 'Token and code are required' });
  }

  const result = verifyToken(token, code);

  if (!result.valid) {
    // Determine error type from result
    let errorType = 'invalid_code';
    if (result.error.includes('Invalid token')) errorType = 'invalid_token';
    else if (result.error.includes('expired')) errorType = 'expired';

    req.logger.info('Error response sent', { status: 400, durationMs: Date.now() - startTime, errorType });
    return res.status(400).json({ error: result.error });
  }

  req.logger.info('Response sent', {
    status: 200,
    durationMs: Date.now() - startTime,
    verified: true,
    emailDomain: result.email?.split('@')[1]
  });
  return res.status(200).json({
    success: true,
    message: 'Email verified successfully',
    email: result.email
  });
}, { moduleName: 'api:auth:verify-code' });
