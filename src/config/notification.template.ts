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

const BASE_URL = process.env.APP_URL ?? "https://ijebunortheastlga.gov.ng";

// ============================================================
// 1. STATE OF ORIGIN (SOO)
// ============================================================

export const sooTemplates = {
  // Stage 1 — Invoice Generated / Payment Pending
  invoiceGenerated: {
    sms: `Hello {{applicant_name}}, your Ijebu North East SOO application (#{{application_id}}) has been received. Please pay the processing fee of {{payment_amount}} to initiate review: {{checkout_link}}`,

    emailSubject: `Action Required: Processing Fee for SOO Application #{{application_id}}`,
    emailHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #1a4731; padding: 24px 32px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 20px; }
    .header p { color: #a7f3d0; margin: 4px 0 0; font-size: 13px; }
    .body { padding: 32px; }
    .amount-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }
    .amount-box .label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .amount-box .amount { font-size: 32px; font-weight: bold; color: #15803d; }
    .btn { display: inline-block; background: #15803d; color: #fff !important; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold; margin: 16px 0; }
    .footer { background: #f9fafb; padding: 16px 32px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
    .ref { font-family: monospace; background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Ijebu North East LGA</h1>
      <p>State of Origin — Application Portal</p>
    </div>
    <div class="body">
      <p>Dear <strong>{{applicant_name}}</strong>,</p>
      <p>Thank you for submitting your State of Origin application. Your application details have been securely recorded.</p>
      <p>Application Reference: <span class="ref">#{{application_id}}</span></p>
      <div class="amount-box">
        <div class="label">Processing Fee Due</div>
        <div class="amount">{{payment_amount}}</div>
      </div>
      <p>To initiate the heritage verification process, kindly complete payment of the processing fee using the secure link below:</p>
      <div style="text-align: center;">
        <a href="{{checkout_link}}" class="btn">Pay Processing Fee</a>
      </div>
      <p style="font-size: 13px; color: #6b7280;">Your application will remain pending until payment is confirmed. The processing fee covers administrative and ancestral verification costs.</p>
    </div>
    <div class="footer">
      <p>Ijebu North East Local Government Area, Ogun State, Nigeria</p>
      <p>This is an automated message. Do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`,
  },

  // Stage 2 — Payment Received (Citizen)
  paymentReceived: {
    sms: `Receipt: Payment of {{payment_amount}} for your Ijebu North East SOO certificate (#{{application_id}}) was successful. Your application is now queued for secretariat review.`,

    emailSubject: `Payment Received — SOO Application #{{application_id}}`,
    emailHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #1a4731; padding: 24px 32px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 20px; }
    .body { padding: 32px; }
    .receipt-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .receipt-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #d1fae5; font-size: 14px; }
    .receipt-row:last-child { border-bottom: none; font-weight: bold; }
    .timeline { margin: 24px 0; padding: 0; list-style: none; }
    .timeline li { padding: 8px 0 8px 20px; border-left: 2px solid #86efac; margin-left: 8px; font-size: 14px; color: #374151; position: relative; }
    .timeline li::before { content: ""; position: absolute; left: -5px; top: 12px; width: 8px; height: 8px; background: #15803d; border-radius: 50%; }
    .footer { background: #f9fafb; padding: 16px 32px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✓ Payment Confirmed</h1>
    </div>
    <div class="body">
      <p>Dear <strong>{{applicant_name}}</strong>,</p>
      <p>We have successfully received your payment. Your application is now queued for review.</p>
      <div class="receipt-box">
        <div class="receipt-row"><span>Invoice Number</span><span>{{invoice_number}}</span></div>
        <div class="receipt-row"><span>Application ID</span><span>#{{application_id}}</span></div>
        <div class="receipt-row"><span>Amount Paid</span><span>{{payment_amount}}</span></div>
        <div class="receipt-row"><span>Status</span><span>✓ Confirmed</span></div>
      </div>
      <p><strong>What happens next?</strong></p>
      <ul class="timeline">
        <li>Secretariat document audit (24 hours)</li>
        <li>Ward ancestry validation by your councillor (48–72 hours)</li>
        <li>Certificate generation and delivery</li>
      </ul>
      <p style="font-size: 13px; color: #6b7280;">You will receive email and SMS updates at each stage. Expected completion: 48–72 hours.</p>
    </div>
    <div class="footer">
      <p>Ijebu North East Local Government Area, Ogun State, Nigeria</p>
    </div>
  </div>
</body>
</html>`,
  },

  // Stage 2 — LGA Desk Alert (internal)
  lgaDeskAlert: {
    emailSubject: `[ACTION REQUIRED] New Paid SOO Application: #{{application_id}}`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border-left: 4px solid #f59e0b;">
    <h2 style="color: #92400e;">⚡ New Paid Application Requires Triage</h2>
    <p>A new paid State of Origin application has been submitted and requires immediate secretariat review.</p>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 16px 0;">
      <tr><td style="padding: 8px; color: #6b7280;">Applicant</td><td style="padding: 8px; font-weight: bold;">{{applicant_name}}</td></tr>
      <tr style="background: #f9fafb;"><td style="padding: 8px; color: #6b7280;">Application ID</td><td style="padding: 8px; font-family: monospace;">#{{application_id}}</td></tr>
      <tr><td style="padding: 8px; color: #6b7280;">Ward</td><td style="padding: 8px;">{{ward_name}}</td></tr>
      <tr style="background: #f9fafb;"><td style="padding: 8px; color: #6b7280;">Amount Paid</td><td style="padding: 8px; font-weight: bold; color: #15803d;">{{payment_amount}}</td></tr>
    </table>
    <a href="${BASE_URL}/dashboard/applications" style="display: inline-block; background: #1a4731; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Open Admin Queue →</a>
  </div>
</body>
</html>`,
  },

  // Stage 3 — Forwarded to Councillor
  forwardedToCouncillor: {
    sms_citizen: `Update: Your Ijebu North East SOO application (#{{application_id}}) has passed central review and has been routed to the {{ward_name}} desk for validation.`,
    sms_councillor: `LGA Alert: Hon. {{councillor_name}}, a new State of Origin verification request for {{applicant_name}} has been routed to your signature desk. Log in to review: ${BASE_URL}/dashboard/applications`,

    emailSubject: `Application Update: Verification routed to {{ward_name}} Desk`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px;">
    <div style="background: #1a4731; padding: 20px; border-radius: 8px 8px 0 0; margin: -32px -32px 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 20px;">Application Update</h1>
    </div>
    <p>Dear <strong>{{applicant_name}}</strong>,</p>
    <p>Great news! Your State of Origin application has cleared central secretariat review and has been routed to the next stage.</p>
    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px;">Your application <strong>#{{application_id}}</strong> has been forwarded to <strong>Hon. {{councillor_name}}</strong> of the <strong>{{ward_name}}</strong> desk for ancestral lineage validation.</p>
    </div>
    <p style="font-size: 14px; color: #6b7280;">This stage involves verification of ancestral and residency records within the ward. You will be notified immediately once the councillor completes their review.</p>
  </div>
</body>
</html>`,
  },

  // Stage 4 — Rejected
  rejected: {
    sms: `Attention {{applicant_name}}, your Ijebu North East SOO application requires update. Reason: {{rejection_reason}}. Please log in to your dashboard to edit and re-submit: ${BASE_URL}/dashboard`,

    emailSubject: `Action Required: SOO Application Update #{{application_id}}`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border-top: 4px solid #ef4444;">
    <h2>Application Update Required</h2>
    <p>Dear <strong>{{applicant_name}}</strong>,</p>
    <p>Our verification team was unable to authenticate the ancestry or residency details in your application <strong>#{{application_id}}</strong>.</p>
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #7f1d1d;"><strong>Reason for update required:</strong><br>{{rejection_reason}}</p>
    </div>
    <p>You may edit and re-submit your application at no additional charge. Please log in to your dashboard and update the flagged details.</p>
    <a href="${BASE_URL}/dashboard/applications" style="display: inline-block; background: #1a4731; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; margin-top: 8px;">Update Application →</a>
  </div>
</body>
</html>`,
  },

  // Stage 5 — Certificate Issued
  certificateIssued: {
    sms: `Congratulations {{applicant_name}}! Your Ijebu North East State of Origin Certificate has been officially issued. Download your secure copy here: {{download_link}}`,

    emailSubject: `Your Official Certificate of State of Origin is Ready!`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #1a4731, #15803d); padding: 40px; text-align: center;">
      <h1 style="color: #fff; margin: 0 0 8px; font-size: 24px;">🎉 Certificate Ready!</h1>
      <p style="color: #a7f3d0; margin: 0;">Ijebu North East Local Government Area</p>
    </div>
    <div style="padding: 32px;">
      <p>Dear <strong>{{applicant_name}}</strong>,</p>
      <p>Congratulations! Your State of Origin certificate has been officially issued and digitally signed by the Ijebu North East Local Government Authority.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{{download_link}}" style="display: inline-block; background: #15803d; color: #fff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-weight: bold; font-size: 16px;">Download Certificate →</a>
      </div>
      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; font-size: 13px; color: #6b7280;">
        <p style="margin: 0 0 8px;"><strong>Important notes:</strong></p>
        <ul style="margin: 0; padding-left: 16px;">
          <li>Your certificate contains a secure QR code for instant verification</li>
          <li>Print on A4 paper for official submissions</li>
          <li>Verify authenticity at: ${BASE_URL}/verify</li>
        </ul>
      </div>
    </div>
  </div>
</body>
</html>`,
  },
};

// ============================================================
// 2. TRADE PERMITS & LEVIES
// ============================================================

export const permitTemplates = {
  // Stage 1 — Invoice Generated
  invoiceGenerated: {
    sms: `Hello, your Trade Permit fee of {{payment_amount}} for {{business_name}} is pending. Securely pay online to start review: {{checkout_link}}`,

    emailSubject: `Invoice Generated: Trade Permit Application for {{business_name}}`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border-top: 4px solid #1a4731;">
    <h2>Trade Permit Application — Invoice</h2>
    <p>Dear Business Owner,</p>
    <p>Your Trade Permit application for <strong>{{business_name}}</strong> has been received. Please complete payment to begin the review process.</p>
    <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
      <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Amount Due</div>
      <div style="font-size: 32px; font-weight: bold; color: #15803d;">{{payment_amount}}</div>
      <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">{{permit_type}}</div>
    </div>
    <div style="text-align: center;">
      <a href="{{checkout_link}}" style="display: inline-block; background: #15803d; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold;">Pay Now →</a>
    </div>
  </div>
</body>
</html>`,
  },

  // Stage 2 — Permit Approved
  permitApproved: {
    sms: `Success! The Trade Permit for {{business_name}} is approved and active. Check your email to download your official license.`,

    emailSubject: `APPROVED: Your Trade Permit for {{business_name}} is Active`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #1a4731, #15803d); padding: 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0;">✓ Permit Approved</h1>
    </div>
    <div style="padding: 32px;">
      <p>Your <strong>{{permit_type}}</strong> for <strong>{{business_name}}</strong> has been formally approved by the Ijebu North East LGA Secretariat.</p>
      <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px;">
        <p style="margin: 0;"><strong>Compliance Reminder:</strong> Your permit must be visibly displayed at your business premises at all times. Failure to display may result in enforcement action.</p>
      </div>
      <div style="text-align: center;">
        <a href="{{download_link}}" style="display: inline-block; background: #15803d; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold;">Download Permit →</a>
      </div>
    </div>
  </div>
</body>
</html>`,
  },

  // Stage 3 — Permit Rejected
  permitRejected: {
    emailSubject: `Attention Needed: Trade Permit Application for {{business_name}}`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border-top: 4px solid #ef4444;">
    <h2>Trade Permit — Update Required</h2>
    <p>Dear Business Owner,</p>
    <p>The regulatory team has reviewed your <strong>{{permit_type}}</strong> application for <strong>{{business_name}}</strong> and requires amendments before approval can be granted.</p>
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #7f1d1d;"><strong>Compliance Issue:</strong><br>{{rejection_reason}}</p>
    </div>
    <p>Please log in to your dashboard to review and update your application.</p>
    <a href="${BASE_URL}/dashboard/permits" style="display: inline-block; background: #1a4731; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Update Application →</a>
  </div>
</body>
</html>`,
  },

  // Stage 4 — Levy Assessment
  levyAssessment: {
    sms: `Notice: {{levy_name}} is due for {{business_name}}. Settle the {{payment_amount}} fee before {{due_date}} to avoid penalties: {{checkout_link}}`,

    emailSubject: `Notice of Local Government Levy: {{levy_name}} - {{business_name}}`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border-top: 4px solid #f59e0b;">
    <h2>📋 Levy Assessment Notice</h2>
    <p>Dear Business Owner (<strong>{{business_name}}</strong>),</p>
    <p>This is an official notice of outstanding local government levy assessment for the current period.</p>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 20px 0;">
      <tr style="background: #f9fafb;"><td style="padding: 10px; color: #6b7280;">Levy Type</td><td style="padding: 10px; font-weight: bold;">{{levy_name}}</td></tr>
      <tr><td style="padding: 10px; color: #6b7280;">Amount Due</td><td style="padding: 10px; font-weight: bold; color: #b45309;">{{payment_amount}}</td></tr>
      <tr style="background: #f9fafb;"><td style="padding: 10px; color: #6b7280;">Due Date</td><td style="padding: 10px; font-weight: bold; color: #ef4444;">{{due_date}}</td></tr>
    </table>
    <p style="font-size: 13px; color: #6b7280;">Late payments attract penalty surcharges as stipulated in LGA revenue guidelines. Persistent non-compliance may result in business permit suspension.</p>
    <a href="{{checkout_link}}" style="display: inline-block; background: #15803d; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold; margin-top: 8px;">Pay Levy Now →</a>
  </div>
</body>
</html>`,
  },

  // Stage 5 — Overdue Warning
  overdueWarning: {
    sms: `Urgent: Levy for {{business_name}} is overdue. Please pay {{payment_amount}} immediately to avoid business suspension: {{checkout_link}}`,

    emailSubject: `OVERDUE NOTICE: Surcharge applied to {{business_name}}`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border-top: 4px solid #ef4444;">
    <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <h2 style="color: #991b1b; margin: 0;">⚠️ OVERDUE PAYMENT NOTICE</h2>
    </div>
    <p>Dear Business Owner (<strong>{{business_name}}</strong>),</p>
    <p>Your <strong>{{levy_name}}</strong> payment of <strong>{{payment_amount}}</strong> has exceeded its due date. Penalty charges are now compounding on the outstanding balance.</p>
    <p style="color: #991b1b; font-weight: bold;">Continued non-payment may result in:</p>
    <ul style="color: #7f1d1d; font-size: 14px;">
      <li>Escalating penalty surcharges</li>
      <li>Temporary suspension of your trade permit</li>
      <li>Field enforcement action by LGA officers</li>
    </ul>
    <a href="{{checkout_link}}" style="display: inline-block; background: #ef4444; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold; margin-top: 8px;">Pay Now — Avoid Suspension →</a>
  </div>
</body>
</html>`,
  },

  // Stage 6 — Permit Suspended
  permitSuspended: {
    sms: `Urgent: The trade permit for {{business_name}} has been suspended. Reason: {{suspension_reason}}. Contact the LGA Secretariat immediately.`,

    emailSubject: `CRITICAL NOTICE: Suspension of Trade Permit for {{business_name}}`,
    emailHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border-top: 4px solid #dc2626;">
    <div style="background: #dc2626; color: #fff; padding: 16px; border-radius: 8px; margin-bottom: 24px; text-align: center;">
      <h2 style="margin: 0;">🔴 TRADE PERMIT SUSPENDED</h2>
    </div>
    <p>Dear Business Owner (<strong>{{business_name}}</strong>),</p>
    <p>This is an official notice that your <strong>{{permit_type}}</strong> has been administratively suspended effective immediately.</p>
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px;"><strong>Reason for Suspension:</strong><br>{{suspension_reason}}</p>
    </div>
    <p><strong>To lift this suspension, you must:</strong></p>
    <ol style="font-size: 14px;">
      <li>Clear all outstanding levy balances</li>
      <li>Pass a secondary compliance inspection</li>
      <li>File a reinstatement request via the LGA portal</li>
    </ol>
    <p style="font-size: 13px; color: #6b7280;">Operating under a suspended permit is a violation of LGA commercial regulations and may attract further penalties.</p>
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
};

// ============================================================
// EXPORT ALL
// ============================================================

export const NotificationTemplates = {
  soo: sooTemplates,
  permit: permitTemplates,
  complaint: complaintTemplates,
  account: accountTemplates,
};

export type TemplateVars = Record<string, string>;
