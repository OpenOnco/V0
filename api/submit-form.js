import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { submission } = req.body;

  if (!submission) {
    return res.status(400).json({ error: 'Submission data required' });
  }

  const jsonString = JSON.stringify(submission, null, 2);
  const testName = submission.data?.name || 'Unknown Test';
  const category = submission.category || 'Unknown';
  const submissionType = submission.submissionType === 'new' ? 'New Test' : 'Correction';
  const contactEmail = submission.contactEmail || 'Not provided';

  try {
    await resend.emails.send({
      from: 'OpenOnco Submissions <noreply@openonco.org>',
      to: 'alexgdickinson@gmail.com',
      subject: `OpenOnco ${submissionType}: ${testName} (${category}) - VERIFIED`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
          <h2 style="color: #2A63A4;">New OpenOnco Submission</h2>
          
          <div style="background-color: #d1fae5; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px;">
            <strong style="color: #065f46;">✓ Email Verified:</strong> 
            <span style="color: #065f46;">${contactEmail}</span>
          </div>
          
          <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Type</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${submissionType}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Category</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${category}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Test Name</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${testName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Contact</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${contactEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Timestamp</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${submission.timestamp}</td>
            </tr>
          </table>
          
          <h3 style="color: #374151;">Full JSON Data:</h3>
          <pre style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 12px;">${jsonString}</pre>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">Sent from OpenOnco submission form</p>
        </div>
      `
    });

    return res.status(200).json({ success: true, message: 'Submission sent successfully' });
  } catch (error) {
    console.error('Error sending submission:', error);
    return res.status(500).json({ error: 'Failed to send submission' });
  }
}
