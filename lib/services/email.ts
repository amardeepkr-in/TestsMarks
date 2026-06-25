import nodemailer from 'nodemailer';
import db from '@/lib/db';

// Email configuration from environment variables
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASSWORD || '',
  },
};

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@testmarks.com';
const ENABLE_EMAIL = process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'false';

// Create email transporter
function createTransporter() {
  return nodemailer.createTransport(SMTP_CONFIG);
}

// Email queue functions
export async function queueEmail(
  toEmail: string,
  subject: string,
  body: string
): Promise<number> {
  const result = db.prepare(
    `INSERT INTO email_queue (to_email, subject, body, status, attempts, created_at)
     VALUES (?, ?, ?, 'pending', 0, datetime('now'))`
  ).run(toEmail, subject, body);

  return result.lastInsertRowid as number;
}

// Send email directly via SMTP
export async function sendEmail(
  toEmail: string,
  subject: string,
  htmlBody: string,
  textBody?: string
): Promise<{ success: boolean; error?: string }> {
  if (!ENABLE_EMAIL) {
    console.log('Email notifications disabled. Would have sent:', { toEmail, subject });
    return { success: true };
  }

  if (!SMTP_CONFIG.auth.user || !SMTP_CONFIG.auth.pass) {
    console.error('SMTP credentials not configured');
    return { success: false, error: 'SMTP credentials not configured' };
  }

  try {
    const transporter = createTransporter();

    await transporter.sendMail({
      from: FROM_EMAIL,
      to: toEmail,
      subject,
      html: htmlBody,
      text: textBody || htmlBody.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Process email queue (max 3 attempts per email)
export async function processEmailQueue(limit: number = 10): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  // Get pending emails with less than 3 attempts
  const emails = db.prepare(
    `SELECT id, to_email, subject, body, attempts
     FROM email_queue
     WHERE status = 'pending' AND attempts < 3
     ORDER BY created_at ASC
     LIMIT ?`
  ).all(limit) as Array<{
    id: number;
    to_email: string;
    subject: string;
    body: string;
    attempts: number;
  }>;

  let succeeded = 0;
  let failed = 0;

  for (const email of emails) {
    const result = await sendEmail(email.to_email, email.subject, email.body);

    if (result.success) {
      // Mark as sent
      db.prepare(
        `UPDATE email_queue
         SET status = 'sent', sent_at = datetime('now'), attempts = attempts + 1
         WHERE id = ?`
      ).run(email.id);
      succeeded++;
    } else {
      // Increment attempts and update error
      const newAttempts = email.attempts + 1;
      const newStatus = newAttempts >= 3 ? 'failed' : 'pending';

      db.prepare(
        `UPDATE email_queue
         SET status = ?, attempts = ?, last_error = ?
         WHERE id = ?`
      ).run(newStatus, newAttempts, result.error || 'Unknown error', email.id);
      failed++;
    }
  }

  return {
    processed: emails.length,
    succeeded,
    failed,
  };
}

// Email templates
export function getSubmissionConfirmationEmail(data: {
  studentName: string;
  rollNumber: string;
  examName: string;
  submissionDate: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: white; padding: 15px; margin: 15px 0; border-radius: 6px; border-left: 4px solid #4F46E5; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Submission Confirmed</h1>
    </div>
    <div class="content">
      <p>Dear ${data.studentName},</p>
      <p>Your exam submission has been successfully received and recorded in our system.</p>

      <div class="info-box">
        <strong>Submission Details:</strong><br>
        <strong>Roll Number:</strong> ${data.rollNumber}<br>
        <strong>Exam:</strong> ${data.examName}<br>
        <strong>Submitted On:</strong> ${data.submissionDate}
      </div>

      <p>You will receive another email notification once your marks are available.</p>
      <p>You can check your results anytime by logging into the student portal with your roll number and access code.</p>

      <p>If you have any questions, please contact your exam coordinator.</p>

      <p>Best regards,<br>TestMarks Team</p>
    </div>
    <div class="footer">
      <p>This is an automated email. Please do not reply to this message.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getMarksUpdateEmail(data: {
  studentName: string;
  rollNumber: string;
  examName: string;
  marks: number;
  totalMarks: number;
  grade?: string;
}): string {
  const percentage = ((data.marks / data.totalMarks) * 100).toFixed(2);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .marks-box { background: white; padding: 20px; margin: 20px 0; border-radius: 6px; text-align: center; border: 2px solid #10B981; }
    .marks-display { font-size: 36px; font-weight: bold; color: #10B981; margin: 10px 0; }
    .info-box { background: white; padding: 15px; margin: 15px 0; border-radius: 6px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Marks Available</h1>
    </div>
    <div class="content">
      <p>Dear ${data.studentName},</p>
      <p>Your marks for the following exam are now available:</p>

      <div class="info-box">
        <strong>Exam Details:</strong><br>
        <strong>Roll Number:</strong> ${data.rollNumber}<br>
        <strong>Exam:</strong> ${data.examName}
      </div>

      <div class="marks-box">
        <div>Your Score</div>
        <div class="marks-display">${data.marks} / ${data.totalMarks}</div>
        <div>Percentage: ${percentage}%</div>
        ${data.grade ? `<div style="margin-top: 10px; font-size: 24px; color: #4F46E5;">Grade: ${data.grade}</div>` : ''}
      </div>

      <p>You can view detailed results by logging into the student portal.</p>

      <p>Congratulations on completing your exam!</p>

      <p>Best regards,<br>TestMarks Team</p>
    </div>
    <div class="footer">
      <p>This is an automated email. Please do not reply to this message.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getAdmitCardUploadEmail(data: {
  studentName: string;
  rollNumber: string;
  examName: string;
  uploadDate: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #8B5CF6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: white; padding: 15px; margin: 15px 0; border-radius: 6px; border-left: 4px solid #8B5CF6; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Admit Card Available</h1>
    </div>
    <div class="content">
      <p>Dear ${data.studentName},</p>
      <p>Your admit card has been uploaded and is now available for download.</p>

      <div class="info-box">
        <strong>Details:</strong><br>
        <strong>Roll Number:</strong> ${data.rollNumber}<br>
        <strong>Exam:</strong> ${data.examName}<br>
        <strong>Uploaded On:</strong> ${data.uploadDate}
      </div>

      <p>Please log in to the student portal to download your admit card. Make sure to bring a printed copy to the examination center.</p>

      <p><strong>Important:</strong> Verify all details on your admit card. If you find any discrepancies, contact the exam coordinator immediately.</p>

      <p>Best regards,<br>TestMarks Team</p>
    </div>
    <div class="footer">
      <p>This is an automated email. Please do not reply to this message.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getWelcomeEmail(data: {
  studentName: string;
  rollNumber: string;
  accessCode: string;
  portalUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .credentials-box { background: white; padding: 20px; margin: 20px 0; border-radius: 6px; border: 2px solid #4F46E5; }
    .access-code { font-size: 32px; font-weight: bold; color: #4F46E5; text-align: center; letter-spacing: 4px; margin: 15px 0; font-family: monospace; }
    .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 15px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to TestMarks</h1>
    </div>
    <div class="content">
      <p>Dear ${data.studentName},</p>
      <p>Welcome to the TestMarks Student Portal! Your account has been created and you can now access your exam results and admit cards.</p>

      <div class="credentials-box">
        <strong>Your Login Credentials:</strong><br><br>
        <strong>Roll Number:</strong> ${data.rollNumber}<br>
        <strong>Access Code:</strong>
        <div class="access-code">${data.accessCode}</div>
      </div>

      <p><strong>⚠️ Important:</strong> Keep your access code secure. Do not share it with anyone.</p>

      <div style="text-align: center;">
        <a href="${data.portalUrl}" class="button">Login to Portal</a>
      </div>

      <p><strong>What you can do in the portal:</strong></p>
      <ul>
        <li>View your exam submissions and marks</li>
        <li>Download admit cards</li>
        <li>Track your academic progress</li>
      </ul>

      <p>If you have any questions or need assistance, please contact your exam coordinator.</p>

      <p>Best regards,<br>TestMarks Team</p>
    </div>
    <div class="footer">
      <p>This is an automated email. Please do not reply to this message.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}


