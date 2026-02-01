import { Resend } from 'resend';
import crypto from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

// Escape HTML to prevent XSS in email templates
function escapeHtml(str) {
  if (!str || typeof str !== 'string') return str || '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================
// DUPLICATE SUBMISSION PROTECTION
// ============================================
const recentSubmissions = new Map();
const DEDUP_WINDOW = 60 * 1000; // 1 minute window

function generateSubmissionHash(submission) {
  // Create a hash from key submission fields to detect duplicates
  const key = JSON.stringify({
    type: submission.submissionType,
    email: submission.submitter?.email,
    // Include content fingerprint based on submission type
    content: submission.submissionType === 'vendor-confirmation'
      ? submission.vendorConfirmation?.testName
      : submission.feedback?.description?.substring(0, 100)
  });
  return crypto.createHash('sha256').update(key).digest('hex').substring(0, 16);
}

function isDuplicateSubmission(hash) {
  const now = Date.now();

  // Clean up old entries
  for (const [key, timestamp] of recentSubmissions.entries()) {
    if (now - timestamp > DEDUP_WINDOW) {
      recentSubmissions.delete(key);
    }
  }

  if (recentSubmissions.has(hash)) {
    return true;
  }

  recentSubmissions.set(hash, now);
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { submission } = req.body;

  if (!submission) {
    return res.status(400).json({ error: 'Submission data required' });
  }

  // Check for duplicate submissions
  const submissionHash = generateSubmissionHash(submission);
  if (isDuplicateSubmission(submissionHash)) {
    // Return success to avoid confusing the user, but don't send duplicate email
    return res.status(200).json({
      success: true,
      message: 'Submission already received',
      duplicate: true
    });
  }

  const jsonString = JSON.stringify(submission, null, 2);
  const submitterName = escapeHtml(`${submission.submitter?.firstName || ''} ${submission.submitter?.lastName || ''}`.trim()) || 'Unknown';
  const submitterEmail = escapeHtml(submission.submitter?.email) || 'Not provided';
  const submissionType = submission.submissionType;

  let subject, detailsHtml, headerColor;

  if (submissionType === 'bug') {
    subject = `OpenOnco Bug Report from ${submitterName}`;
    headerColor = '#dc2626';
    detailsHtml = `
      <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Type</td><td style="padding: 8px; border: 1px solid #ddd;">Bug Report</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold; vertical-align: top;">Description</td><td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${escapeHtml(submission.feedback?.description) || 'No description provided'}</td></tr>
    `;
  } else if (submissionType === 'feature') {
    subject = `OpenOnco Feature Request from ${submitterName}`;
    headerColor = '#9333ea';
    detailsHtml = `
      <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Type</td><td style="padding: 8px; border: 1px solid #ddd;">Feature Request</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold; vertical-align: top;">Description</td><td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${escapeHtml(submission.feedback?.description) || 'No description provided'}</td></tr>
    `;
  } else if (submissionType === 'vendor-confirmation') {
    // Vendor Confirmation submission
    const vc = submission.vendorConfirmation || {};
    const testName = escapeHtml(vc.testName) || 'Unknown Test';
    const vendor = escapeHtml(vc.vendor) || 'Unknown Vendor';
    const category = escapeHtml(submission.category) || 'Unknown';
    const confirmed = vc.confirmed || [];
    const changes = vc.changes || [];
    const totalRecommended = vc.totalRecommendedFields || 0;
    const reviewedCount = confirmed.length + changes.length;

    subject = `OpenOnco Vendor Confirmation: ${testName} (${category}) - ${vendor}`;
    headerColor = '#059669'; // Emerald green

    // Build confirmed fields list
    let confirmedHtml = '';
    if (confirmed.length > 0) {
      confirmedHtml = `
        <h3 style="color: #374151; margin-top: 24px;">✓ Confirmed Fields (${confirmed.length})</h3>
        <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
          <tr style="background: #f9fafb;">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Field</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Confirmed Value</th>
          </tr>
          ${confirmed.map(c => `
            <tr style="background: #ecfdf5;">
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${escapeHtml(c.label || c.field)}</td>
              <td style="padding: 8px; border: 1px solid #ddd; color: #059669;">${escapeHtml(c.value) || '—'}</td>
            </tr>
          `).join('')}
        </table>
      `;
    }

    // Build changes table rows
    let changesHtml = '';
    if (changes.length > 0) {
      changesHtml = `
        <h3 style="color: #374151; margin-top: 24px;">📝 Proposed Updates (${changes.length})</h3>
        <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
          <tr style="background: #f9fafb;">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Field</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Current Value</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">New Value</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Citation</th>
          </tr>
          ${changes.map(c => `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${escapeHtml(c.label || c.field)}</td>
              <td style="padding: 8px; border: 1px solid #ddd; color: #6b7280;">${escapeHtml(c.currentValue) || '—'}</td>
              <td style="padding: 8px; border: 1px solid #ddd; color: #059669; font-weight: bold;">${escapeHtml(c.newValue)}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${c.citation ? `<a href="${escapeHtml(c.citation)}" style="color: #2563eb;">${escapeHtml(c.citation)}</a>` : 'None'}</td>
            </tr>
          `).join('')}
        </table>
      `;
    }
    
    if (confirmed.length === 0 && changes.length === 0) {
      confirmedHtml = `
        <div style="background-color: #fef3c7; padding: 12px 16px; border-radius: 8px; margin: 20px 0;">
          <strong style="color: #92400e;">No fields reviewed</strong>
          <span style="color: #92400e;"> — Submission may be incomplete</span>
        </div>
      `;
    }
    
    detailsHtml = `
      <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Submission Type</td><td style="padding: 8px; border: 1px solid #ddd;"><span style="background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 4px; font-weight: bold;">Vendor Confirmation</span></td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Category</td><td style="padding: 8px; border: 1px solid #ddd;">${category}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Test Name</td><td style="padding: 8px; border: 1px solid #ddd;">${testName}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Vendor</td><td style="padding: 8px; border: 1px solid #ddd;">${vendor}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Test ID</td><td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">${vc.testId || 'N/A'}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Fields Reviewed</td><td style="padding: 8px; border: 1px solid #ddd;">${reviewedCount} of ${totalRecommended} recommended fields</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Confirmed</td><td style="padding: 8px; border: 1px solid #ddd; color: #059669;">${confirmed.length} field(s)</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Updates Proposed</td><td style="padding: 8px; border: 1px solid #ddd; color: #2563eb;">${changes.length} field(s)</td></tr>
    `;
    
    // Submitter info
    const submitterRole = submission.submitter?.role || 'Not provided';
    
    // Override the standard email template for vendor confirmations
    try {
      await resend.emails.send({
        from: 'OpenOnco <noreply@openonco.org>',
        to: 'alexgdickinson@gmail.com',
        replyTo: submitterEmail,
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
            <h2 style="color: ${headerColor};">✓ ${subject}</h2>
            
            <div style="background-color: #d1fae5; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px;">
              <strong style="color: #065f46;">Vendor Email Verified:</strong> 
              <span style="color: #065f46;">${submitterEmail}</span>
            </div>
            
            <h3 style="color: #374151; margin-top: 24px;">Submitter Information</h3>
            <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Name</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${submitterName}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Email</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${submitterEmail}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; font-weight: bold;">Role/Title</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${submitterRole}</td>
              </tr>
            </table>
            
            <h3 style="color: #374151;">Test Details</h3>
            <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
              ${detailsHtml}
            </table>
            
            ${confirmedHtml}
            ${changesHtml}
            
            <div style="background-color: #eff6ff; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
              <strong style="color: #1e40af;">Next Steps:</strong>
              <ol style="color: #1e40af; margin: 8px 0 0 0; padding-left: 20px;">
                <li>Review the confirmed and proposed changes above</li>
                <li>Verify citations are valid</li>
                <li>Update data.js with new values</li>
                <li>Add "vendorConfirmed: true" and "vendorConfirmedDate" to the test record</li>
              </ol>
            </div>
            
            <h3 style="color: #374151;">Full JSON Data:</h3>
            <pre style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 12px;">${jsonString}</pre>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #999; font-size: 12px;">Sent from OpenOnco Vendor Confirmation Form at ${submission.timestamp}</p>
          </div>
        `
      });

      return res.status(200).json({ success: true, message: 'Vendor confirmation sent successfully' });
    } catch (error) {
      console.error('Error sending vendor confirmation:', error);
      return res.status(500).json({ error: 'Failed to send vendor confirmation' });
    }
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
      
      // Differentiate validation submissions from regular corrections
      const isValidation = submissionType === 'validation';
      const hasEdits = submission.validation?.edits?.length > 0;
      
      if (isValidation) {
        subject = hasEdits 
          ? `OpenOnco Vendor Validation + Edits: ${testName} (${category})`
          : `OpenOnco Vendor Validation: ${testName} (${category})`;
      } else {
        subject = `OpenOnco Correction Request: ${testName} (${category}) - ${submitterType}`;
      }
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
