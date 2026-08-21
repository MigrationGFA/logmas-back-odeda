// src/notifications/templates/index.ts
// ============================================================
// LOGMAS NOTIFICATION TEMPLATES
// Ijebu North East Local Government
// ============================================================
// Usage: interpolate(templates.soo.invoiceGenerated.sms, { applicant_name: "John", ... })

export const interpolate = (
  template: string,
  vars: Record<string, string>,
): string => {
  return Object.entries(vars).reduce(
    (str, [key, val]) => str.replaceAll(`{{${key}}}`, val ?? ""),
    template,
  );
};

const BASE_URL = process.env.FRONTEND_URL;

export const applicationTemplates = {
  // Application Submitted - Initial Confirmation
  applicationSubmitted: {
    emailSubject: `Application Submitted: #{{application_number}} - {{service_name}}`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px;">
    <h2>Application Received</h2>
    <p>Dear {{applicant_name}},</p>
    <p>Your application for <strong>{{service_name}}</strong> has been successfully submitted and is now under review.</p>
    <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px;">
      <div style="margin-bottom: 8px;"><span style="color: #6b7280;">Application Number:</span> <strong style="font-family: monospace;">{{application_number}}</strong></div>
      <div style="margin-bottom: 8px;"><span style="color: #6b7280;">Service:</span> {{service_name}}</div>
      <div style="margin-bottom: 8px;"><span style="color: #6b7280;">Amount:</span> ₦{{fee_amount}}</div>
      <div><span style="color: #6b7280;">Status:</span> <span style="color: #f59e0b; font-weight: bold;">Under Review</span></div>
    </div>
    <p style="font-size: 13px; color: #6b7280;">You will be notified once a decision has been made on your application.</p>
    <a href="${BASE_URL}/dashboard/applications/{{application_id}}" style="display: inline-block; background: #1a4731; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Track Application →</a>
  </div>
</body>
</html>`,
  },

  // Application Approved
  applicationApproved: {
    emailSubject: `Application Approved: #{{application_number}} - {{service_name}}`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border-top: 4px solid #10b981;">
    <h2 style="color: #065f46;">✓ Application Approved</h2>
    <p>Dear {{applicant_name}},</p>
    <p>We are pleased to inform you that your application for <strong>{{service_name}}</strong> has been <strong style="color: #10b981;">approved</strong>.</p>
    <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px;">
      <div style="margin-bottom: 8px;"><span style="color: #6b7280;">Application Number:</span> <strong style="font-family: monospace;">{{application_number}}</strong></div>
      <div style="margin-bottom: 8px;"><span style="color: #6b7280;">Service:</span> {{service_name}}</div>
      // <div style="margin-bottom: 8px;"><span style="color: #6b7280;">Reviewed By:</span> {{reviewer_name}}</div>
      <div style="margin-bottom: 8px;"><span style="color: #6b7280;">Reviewed At:</span> {{reviewed_at}}</div>
      <div><span style="color: #6b7280;">Status:</span> <span style="color: #10b981; font-weight: bold;">Approved</span></div>
    </div>
    {{#if certificate}}
    <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; font-size: 13px; color: #92400e;">
        <strong>Certificate Information:</strong><br>
        Certificate Number: {{certificate.certificate_number}}<br>
        Verification Code: {{certificate.verification_code}}
      </p>
    </div>
    {{/if}}
    {{#if invoice}}
    <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 4px; font-size: 13px; color: #6b7280;">Payment Details</p>
      <p style="margin: 0; font-size: 14px;">
        <strong>Amount Due:</strong> ₦{{invoice.amount}}<br>
        <strong>Invoice Number:</strong> {{invoice.invoice_number}}<br>
        <strong>Status:</strong> {{invoice.payment_status}}
      </p>
    </div>
    {{/if}}
    <p style="font-size: 13px; color: #6b7280;">Please proceed with payment to receive your certificate/license.</p>
    <a href="${BASE_URL}/dashboard/applications/{{application_id}}" style="display: inline-block; background: #1a4731; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">View Application →</a>
  </div>
</body>
</html>`,
  },

  // Application Declined
  applicationDeclined: {
    emailSubject: `Application Update: #{{application_number}} - {{service_name}}`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border-top: 4px solid #ef4444;">
    <h2 style="color: #991b1b;">Application Declined</h2>
    <p>Dear {{applicant_name}},</p>
    <p>We regret to inform you that your application for <strong>{{service_name}}</strong> has been <strong style="color: #ef4444;">declined</strong>.</p>
    <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px;">
      <div style="margin-bottom: 8px;"><span style="color: #6b7280;">Application Number:</span> <strong style="font-family: monospace;">{{application_number}}</strong></div>
      <div style="margin-bottom: 8px;"><span style="color: #6b7280;">Service:</span> {{service_name}}</div>
      <div style="margin-bottom: 8px;"><span style="color: #6b7280;">Reviewed By:</span> {{reviewer_name}}</div>
      <div style="margin-bottom: 8px;"><span style="color: #6b7280;">Reviewed At:</span> {{reviewed_at}}</div>
      <div><span style="color: #6b7280;">Status:</span> <span style="color: #ef4444; font-weight: bold;">Declined</span></div>
    </div>
    {{#if decline_reason}}
    <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 4px; font-size: 12px; color: #6b7280; text-transform: uppercase;">Reason for Decline</p>
      <p style="margin: 0; font-size: 14px;">{{decline_reason}}</p>
    </div>
    {{/if}}
    <p style="font-size: 13px; color: #6b7280;">If you have any questions or would like to reapply, please contact our support team.</p>
    <div style="margin-top: 20px;">
      <a href="${BASE_URL}/dashboard/applications/{{application_id}}" style="display: inline-block; background: #6b7280; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; margin-right: 12px;">View Details</a>
      <a href="${BASE_URL}/services/{{service_id}}" style="display: inline-block; background: #1a4731; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Reapply</a>
    </div>
  </div>
</body>
</html>`,
  },


  // Invoice Generated
  invoiceGenerated: {
    emailSubject: `Invoice Generated: {{invoice_number}} - {{service_name}}`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px;">
    <h2>Invoice Generated</h2>
    <p>Dear {{applicant_name}},</p>
    <p>An invoice has been generated for your <strong>{{service_name}}</strong> application.</p>
    <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px;">
      <div style="margin-bottom: 8px;"><span style="color: #6b7280;">Invoice Number:</span> <strong style="font-family: monospace;">{{invoice_number}}</strong></div>
      <div style="margin-bottom: 8px;"><span style="color: #6b7280;">Application:</span> {{application_number}}</div>
      <div style="margin-bottom: 8px;"><span style="color: #6b7280;">Amount Due:</span> <strong style="color: #1a4731;">₦{{amount}}</strong></div>
      <div><span style="color: #6b7280;">Status:</span> <span style="color: #f59e0b; font-weight: bold;">Pending Payment</span></div>
    </div>
    {{#if virtual_account}}
    <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 8px; font-size: 13px; color: #92400e; font-weight: bold;">Virtual Account Details</p>
      <p style="margin: 0; font-size: 14px;">
        <strong>Bank:</strong> {{virtual_account.bank_name}}<br>
        <strong>Account Number:</strong> {{virtual_account.account_number}}<br>
        <strong>Account Name:</strong> {{virtual_account.account_name}}<br>
        <strong>Reference:</strong> {{virtual_account.reference}}
      </p>
    </div>
    {{/if}}
    <p style="font-size: 13px; color: #6b7280;">Please complete payment to finalize your application.</p>
    <a href="${BASE_URL}/dashboard/payments/{{invoice_id}}" style="display: inline-block; background: #1a4731; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Make Payment →</a>
  </div>
</body>
</html>`,
  },

  // Payment Confirmed
  paymentConfirmed: {
    emailSubject: `Payment Confirmed: {{invoice_number}} - {{service_name}}`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border-top: 4px solid #10b981;">
    <h2 style="color: #065f46;">✓ Payment Confirmed</h2>
    <p>Dear {{applicant_name}},</p>
    <p>We have received your payment of <strong>₦{{amount}}</strong> for <strong>{{service_name}}</strong>.</p>
    <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px;">
      <div style="margin-bottom: 8px;"><span style="color: #6b7280;">Invoice Number:</span> {{invoice_number}}</div>
      <div style="margin-bottom: 8px;"><span style="color: #6b7280;">Amount Paid:</span> ₦{{amount}}</div>
      <div style="margin-bottom: 8px;"><span style="color: #6b7280;">Transaction Reference:</span> {{transaction_ref}}</div>
      <div style="margin-bottom: 8px;"><span style="color: #6b7280;">Payment Method:</span> {{payment_method}}</div>
      <div><span style="color: #6b7280;">Status:</span> <span style="color: #10b981; font-weight: bold;">Confirmed</span></div>
    </div>
    {{#if receipt}}
    <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 4px; font-size: 13px; color: #6b7280;">Receipt Information</p>
      <p style="margin: 0; font-size: 14px;">
        <strong>Receipt Number:</strong> {{receipt.receipt_number}}<br>
        <strong>Verification Code:</strong> {{receipt.verification_code}}
      </p>
    </div>
    {{/if}}
    <p style="font-size: 13px; color: #6b7280;">Your certificate will be generated and made available shortly.</p>
    <a href="${BASE_URL}/dashboard/applications/{{application_id}}" style="display: inline-block; background: #1a4731; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">View Application →</a>
  </div>
</body>
</html>`,
  },
};

// ============================================================
// 3. COMPLAINTS / HELPDESK
// ============================================================

export const complaintTemplates = {
  // Stage 1 — Ticket Opened (Citizen)
  ticketOpened: {
    emailSubject: `Ticket Opened: #{{ticket_number}} - {{complaint_title}}`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px;">
    <h2>Support Ticket Created</h2>
    <p>Dear {{applicant_name}},</p>
    <p>Your complaint has been received and logged in our helpdesk system. Our support team will review and respond within <strong>48 hours</strong>.</p>
    <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px;">
      <div style="margin-bottom: 8px;"><span style="color: #6b7280;">Ticket Number:</span> <strong style="font-family: monospace;">{{ticket_number}}</strong></div>
      <div style="margin-bottom: 8px;"><span style="color: #6b7280;">Subject:</span> {{complaint_title}}</div>
      <div><span style="color: #6b7280;">Category:</span> {{complaint_category}}</div>
    </div>
    <p style="font-size: 13px; color: #6b7280;">Track your ticket status at any time by logging into your dashboard.</p>
    <a href="${BASE_URL}/dashboard/complaints" style="display: inline-block; background: #1a4731; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">View Ticket →</a>
  </div>
</body>
</html>`,
  },

  // Stage 2 — Assigned to Officer
  ticketAssigned: {
    emailSubject: `[ASSIGNED TICKET] #{{ticket_number}} - {{complaint_title}}`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border-left: 4px solid #3b82f6;">
    <h2 style="color: #1e40af;">New Ticket Assigned to You</h2>
    <p>A support ticket has been assigned to you for resolution.</p>
    <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px;">
      <div style="margin-bottom: 8px;"><span style="color: #6b7280;">Ticket:</span> <strong style="font-family: monospace;">{{ticket_number}}</strong></div>
      <div style="margin-bottom: 8px;"><span style="color: #6b7280;">Subject:</span> {{complaint_title}}</div>
      <div><span style="color: #6b7280;">Category:</span> {{complaint_category}}</div>
    </div>
    <a href="${BASE_URL}/dashboard/complaints" style="display: inline-block; background: #1d4ed8; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Open Ticket →</a>
  </div>
</body>
</html>`,
  },

  // Stage 3 — New Response Posted
  newResponse: {
    emailSubject: `New Reply on Ticket #{{ticket_number}} - {{complaint_title}}`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px;">
    <h2>New Reply on Your Ticket</h2>
    <p><strong>{{responder_name}}</strong> has responded to ticket <strong>{{ticket_number}}</strong>.</p>
    <div style="background: #f3f4f6; border-left: 3px solid #1a4731; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; font-size: 14px; font-style: italic;">{{response_message}}</p>
    </div>
    <a href="${BASE_URL}/dashboard/complaints" style="display: inline-block; background: #1a4731; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Reply →</a>
  </div>
</body>
</html>`,
  },

  // Stage 4 — Resolved
  ticketResolved: {
    emailSubject: `Support Ticket Closed: #{{ticket_number}} - {{complaint_title}}`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border-top: 4px solid #10b981;">
    <h2 style="color: #065f46;">✓ Ticket Resolved</h2>
    <p>Your support ticket <strong>{{ticket_number}}</strong> has been officially closed.</p>
    <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 4px; font-size: 12px; color: #6b7280; text-transform: uppercase;">Resolution</p>
      <p style="margin: 0; font-size: 14px;">{{resolution_note}}</p>
    </div>
    <p style="font-size: 13px; color: #6b7280;">If you feel this issue requires further attention, you may open a new ticket referencing <strong>{{ticket_number}}</strong>.</p>
    <a href="${BASE_URL}/dashboard/complaints" style="display: inline-block; background: #1a4731; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Open New Ticket →</a>
  </div>
</body>
</html>`,
  },
};

// ============================================================
// 4. ACCOUNT & SECURITY
// ============================================================

export const accountTemplates = {
  // Stage 1 — Password Reset
  passwordReset: {
    emailSubject: `Reset your Ijebu North East Portal Password`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border-top: 4px solid #6366f1;">
    <h2>Password Reset Request</h2>
    <p>We received a request to reset the password for your Ijebu North East portal account.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{reset_link}}" style="display: inline-block; background: #4f46e5; color: #fff; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-weight: bold; font-size: 16px;">Reset My Password →</a>
    </div>
    <div style="background: #fef3c7; border-radius: 8px; padding: 16px; font-size: 13px;">
      <p style="margin: 0;"><strong>⏱ This link expires in {{expiration_time}}.</strong><br>If you did not request a password reset, please ignore this email. Your account remains secure.</p>
    </div>
  </div>
</body>
</html>`,
  },

  // Stage 2 — Account Suspended
  accountSuspended: {
    emailSubject: `Security Notice: Portal Access Suspended`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border-top: 4px solid #dc2626;">
    <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <h2 style="color: #991b1b; margin: 0;">🔒 Account Suspended</h2>
    </div>
    <p>Dear {{applicant_name}},</p>
    <p>For the security and integrity of the Ijebu North East portal, your account has been temporarily suspended.</p>
    <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px;">
      <p style="margin: 0;"><strong>Reason:</strong> {{suspension_reason}}</p>
    </div>
    <p>To restore your portal access, please contact the LGA Secretariat directly:</p>
    <ul style="font-size: 14px;">
      <li>Visit the LGA office during business hours</li>
      <li>Submit a verified identity document for review</li>
    </ul>
    <p style="font-size: 13px; color: #6b7280;">If you believe this suspension is in error, please contact the help desk immediately.</p>
  </div>
</body>
</html>`,
  },
  // Add to accountTemplates in src/notifications/templates/index.ts,
  // alongside passwordReset and accountSuspended.

  passwordChanged: {
    sms: `Hello {{applicant_name}}, your Ijebu North East portal password was just changed. If this wasn't you, contact the LGA Secretariat immediately.`,

    emailSubject: `Your Password Was Changed`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border-top: 4px solid #1a4731;">
    <h2>Password Changed</h2>
    <p>Dear <strong>{{applicant_name}}</strong>,</p>
    <p>This confirms that the password for your Ijebu North East portal account was just changed.</p>
    <div style="background: #fef3c7; border-radius: 8px; padding: 16px; font-size: 13px; margin-top: 16px;">
      <p style="margin: 0;"><strong>Didn't do this?</strong> Contact the LGA Secretariat immediately — your account may be compromised.</p>
    </div>
  </div>
</body>
</html>`,
  },

  accountReactivated: {
    sms: `Hello {{applicant_name}}, your Ijebu North East portal account has been reactivated. You can now log in as usual.`,

    emailSubject: `Your Account Has Been Reactivated`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border-top: 4px solid #15803d;">
    <h2 style="color: #15803d;">✓ Account Reactivated</h2>
    <p>Dear <strong>{{applicant_name}}</strong>,</p>
    <p>Your Ijebu North East portal account has been reactivated. You may log in as usual.</p>
  </div>
</body>
</html>`,
  },

  passwordResetByAdmin: {
    sms: `Hello {{applicant_name}}, your LOGMAS password was reset by an administrator. Temporary password: {{temp_password}}. You must change it on next login.`,

    emailSubject: `Your Password Was Reset`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border-top: 4px solid #6366f1;">
    <h2>Password Reset by Administrator</h2>
    <p>Dear <strong>{{applicant_name}}</strong>,</p>
    <p>An administrator has reset your password. Use the temporary password below to log in — you'll be required to set a new one immediately.</p>
    <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
      <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 8px;">Temporary Password</div>
      <div style="font-family: monospace; font-size: 22px; font-weight: bold; letter-spacing: 3px; color: #1a4731;">{{temp_password}}</div>
    </div>
    <div style="background: #fef3c7; border-radius: 8px; padding: 16px; font-size: 13px;">
      <p style="margin: 0;"><strong>Didn't request this?</strong> Contact the LGA Secretariat immediately.</p>
    </div>
  </div>
</body>
</html>`,
  },

  // Welcome — new staff account created
  welcomeStaff: {
    sms: `Welcome to LOGMAS, {{applicant_name}}. Your account has been created. Temporary password: {{temp_password}}. Login at: ${BASE_URL}/login — Change your password immediately.`,

    emailSubject: `Welcome to Ijebu North East LGA Portal — Account Created`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden;">
    <div style="background: #1a4731; padding: 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0;">Welcome to LOGMAS</h1>
      <p style="color: #a7f3d0; margin: 4px 0 0;">Ijebu North East Local Government</p>
    </div>
    <div style="padding: 32px;">
      <p>Dear <strong>{{applicant_name}}</strong>,</p>
      <p>Your staff account has been created on the LOGMAS platform. Please use the credentials below to log in and change your password immediately.</p>
      <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 8px;">Temporary Password</div>
        <div style="font-family: monospace; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1a4731;">{{temp_password}}</div>
      </div>
      <a href="${BASE_URL}/login" style="display: inline-block; background: #1a4731; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold;">Login Now →</a>
      <p style="font-size: 12px; color: #ef4444; margin-top: 16px;">⚠️ You will be required to change this password on first login.</p>
    </div>
  </div>
</body>
</html>`,
  },

  verifyEmail: {
    emailSubject: `Verify your LOGMAS account`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden;">
    
    <div style="background: #1a4731; padding: 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0;">Welcome to LOGMAS</h1>
      <p style="color: #a7f3d0; margin: 4px 0 0;">
        Local Government Management System
      </p>
    </div>

    <div style="padding: 32px;">
      <p>Dear <strong>{{applicant_name}}</strong>,</p>

      <p>
        Thank you for creating your LOGMAS account.
        Please verify your email address to complete your registration.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a
          href="{{verification_link}}"
          target="_blank"
          style="
            display: inline-block;
            background: #1a4731;
            color: #fff;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 6px;
            font-weight: bold;
          "
        >
          Verify Email Address →
        </a>
      </div>

      <p style="font-size: 13px; color: #6b7280;">
        This verification link will expire in {{expiration_time}}.
      </p>

      <p style="font-size: 13px; color: #6b7280;">
        If you did not create this account, you can safely ignore this email.
      </p>
    </div>

  </div>
</body>
</html>`,
  },
  resendVerificationEmail: {
  emailSubject: `New Email Verification Link — LOGMAS`,
  emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden;">

    <div style="background: #1a4731; padding: 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0;">LOGMAS</h1>
      <p style="color: #a7f3d0; margin: 4px 0 0;">
        Local Government Management System
      </p>
    </div>

    <div style="padding: 32px;">
      <p>Dear <strong>{{applicant_name}}</strong>,</p>

      <p>
        You requested a new email verification link for your LOGMAS account.
        Click the button below to verify your email address.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a
          href="{{verification_link}}"
          style="
            display: inline-block;
            background: #1a4731;
            color: #fff;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 6px;
            font-weight: bold;
          "
        >
          Verify My Email →
        </a>
      </div>

      <p style="font-size: 13px; color: #6b7280;">
        This new verification link will expire in
        <strong>{{expiration_time}}</strong>.
      </p>

      <p style="font-size: 13px; color: #6b7280;">
        If you did not request a new verification link, you can safely
        ignore this email.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

      <p style="font-size: 12px; color: #6b7280;">
        For your security, do not share this verification link with anyone.
      </p>
    </div>

  </div>
</body>
</html>`,
},
};

// ============================================================
// EXPORT ALL
// ============================================================

export const NotificationTemplates = {
  application: applicationTemplates,
  complaint: complaintTemplates,
  account: accountTemplates,
};

export type TemplateVars = Record<string, string>;
