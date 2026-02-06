import { Resend } from 'resend';
import { withVercelLogging } from '../shared/logger/index.js';

const resend = new Resend(process.env.RESEND_API_KEY);

export default withVercelLogging(async (req, res) => {
  const startTime = Date.now();

  if (req.method !== 'POST') {
    req.logger.info('Error response sent', { status: 405, durationMs: Date.now() - startTime });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { feedback, email, testName, sessionContext, url, timestamp } = req.body;

  // Log request
  req.logger.info('Feedback submission received', {
    hasEmail: !!email,
    hasTestName: !!testName,
    feedbackLength: feedback?.length,
    hasSessionContext: !!sessionContext
  });

  if (!feedback) {
    req.logger.info('Error response sent', { status: 400, durationMs: Date.now() - startTime, errorType: 'validation' });
    return res.status(400).json({ error: 'Feedback is required' });
  }

  const subject = testName 
    ? `OpenOnco Error Report: ${testName}`
    : 'OpenOnco Patient Portal Feedback';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${testName ? '#dc2626' : '#f59e0b'}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">${testName ? '🐛 Error Report' : '💬 Patient Portal Feedback'}</h1>
      </div>
      
      <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none;">
        ${testName ? `
          <p style="margin: 0 0 12px 0;"><strong>Test:</strong> ${testName}</p>
        ` : ''}
        
        ${email ? `
          <p style="margin: 0 0 12px 0; padding: 8px 12px; background: #ecfdf5; border-radius: 6px; border-left: 3px solid #10b981;">
            <strong>📧 Contact:</strong> <a href="mailto:${email}" style="color: #059669;">${email}</a> (open to follow-up)
          </p>
        ` : ''}
        
        <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 16px;">
          <p style="margin: 0; white-space: pre-wrap;">${feedback}</p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;">
        
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;"><strong>URL:</strong> ${url || 'Not provided'}</p>
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;"><strong>Time:</strong> ${timestamp || new Date().toISOString()}</p>
        
        ${sessionContext ? `
          <details style="margin-top: 16px;">
            <summary style="cursor: pointer; font-size: 14px; color: #64748b;">Session Context</summary>
            <pre style="background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 6px; font-size: 12px; overflow-x: auto; margin-top: 8px;">${sessionContext}</pre>
          </details>
        ` : ''}
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: 'OpenOnco <noreply@openonco.org>',
      to: ['alexgdickinson@gmail.com'],
      subject,
      html
    });

    req.logger.info('Response sent', {
      status: 200,
      durationMs: Date.now() - startTime,
      emailSent: true
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    req.logger.error('Failed to send feedback email', {
      error,
      feedbackLength: feedback?.length,
      hasTestName: !!testName
    });
    req.logger.info('Error response sent', {
      status: 500,
      durationMs: Date.now() - startTime,
      errorType: 'email_send_failure'
    });
    return res.status(500).json({ error: 'Failed to send feedback' });
  }
}, { moduleName: 'api:forms:feedback' });
