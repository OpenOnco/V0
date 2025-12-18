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
  const submitterName = `${submission.submitter?.firstName || ''} ${submission.submitter?.lastName || ''}`.trim() || 'Unknown';
  const submitterEmail = submission.submitter?.email || 'Not provided';
  const submissionType = submission.submissionType;
  
  let subject, detailsHtml, headerColor;
  
  if (submissionType === 'bug') {
    subject = `OpenOnco Bug Report from ${submitterName}`;
    headerColor = '#dc2626';
    detailsHtml = `
      <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Type</td><td style="padding: 8px; border: 1px solid #ddd;">Bug Report</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold; vertical-align: top;">Description</td><td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${submission.feedback?.description || 'No description provided'}</td></tr>
    `;
  } else if (submissionType === 'feature') {
    subject = `OpenOnco Feature Request from ${submitterName}`;
    headerColor = '#9333ea';
    detailsHtml = `
      <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Type</td><td style="padding: 8px; border: 1px solid #ddd;">Feature Request</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold; vertical-align: top;">Description</td><td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${submission.feedback?.description || 'No description provided'}</td></tr>
    `;
  } else {
    const submitterType = submission.submitterType === 'vendor' ? 'Vendor Representative' : 'Independent Expert';
    const category = submission.category || 'Unknown';
    const isNewTest = submissionType === 'new';
    
    let testName, vendor;
    
    if (isNewTest) {
      testName = submission.newTest?.name || 'Unknown Test';
      vendor = submission.newTest?.vendor || 'Unknown Vendor';
      subject = `OpenOnco New Test Request: ${testName} (${category}) - ${submitterType}`;
      headerColor = '#2A63A4';
      detailsHtml = `
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Submitter Type</td><td style="padding: 8px; border: 1px solid #ddd;">${submitterType}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Category</td><td style="padding: 8px; border: 1px solid #ddd;">${category}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Test Name</td><td style="padding: 8px; border: 1px solid #ddd;">${testName}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Vendor</td><td style="padding: 8px; border: 1px solid #ddd;">${vendor}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Performance Data URL</td><td style="padding: 8px; border: 1px solid #ddd;"><a href="${submission.newTest?.performanceUrl}">${submission.newTest?.performanceUrl}</a></td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Additional Notes</td><td style="padding: 8px; border: 1px solid #ddd;">${submission.newTest?.additionalNotes || 'None'}</td></tr>
      `;
    } else {
      testName = submission.correction?.testName || 'Unknown Test';
      vendor = submission.correction?.vendor || 'Unknown Vendor';
      subject = `OpenOnco Correction Request: ${testName} (${category}) - ${submitterType}`;
      headerColor = '#2A63A4';
      detailsHtml = `
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Submitter Type</td><td style="padding: 8px; border: 1px solid #ddd;">${submitterType}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Category</td><td style="padding: 8px; border: 1px solid #ddd;">${category}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Test Name</td><td style="padding: 8px; border: 1px solid #ddd;">${testName}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Vendor</td><td style="padding: 8px; border: 1px solid #ddd;">${vendor}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Parameter</td><td style="padding: 8px; border: 1px solid #ddd;">${submission.correction?.parameterLabel || submission.correction?.parameter}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Current Value</td><td style="padding: 8px; border: 1px solid #ddd;">${submission.correction?.currentValue || 'Not specified'}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold; color: #059669;">New Value</td><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #059669;">${submission.correction?.newValue}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Citation</td><td style="padding: 8px; border: 1px solid #ddd;"><a href="${submission.correction?.citation}">${submission.correction?.citation}</a></td></tr>
      `;
    }
  }

  try {
    await resend.emails.send({
      from: 'OpenOnco <noreply@openonco.org>',
      to: 'alexgdickinson@gmail.com',
      replyTo: submitterEmail,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
          <h2 style="color: ${headerColor};">${subject}</h2>
          
          <div style="background-color: #d1fae5; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px;">
            <strong style="color: #065f46;">✓ Email Verified:</strong> 
            <span style="color: #065f46;">${submitterEmail}</span>
          </div>
          
          <h3 style="color: #374151; margin-top: 24px;">From</h3>
          <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Name</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${submitterName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Email</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${submitterEmail}</td>
            </tr>
          </table>
          
          <h3 style="color: #374151;">Details</h3>
          <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
            ${detailsHtml}
          </table>
          
          <h3 style="color: #374151;">Full JSON Data:</h3>
          <pre style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 12px;">${jsonString}</pre>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">Sent from OpenOnco at ${submission.timestamp}</p>
        </div>
      `
    });

    return res.status(200).json({ success: true, message: 'Submission sent successfully' });
  } catch (error) {
    console.error('Error sending submission:', error);
    return res.status(500).json({ error: 'Failed to send submission' });
  }
}
