export interface PaymentFailedEmailProps {
  currentPeriodEnd: Date;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export const renderPaymentFailedEmail = ({
  currentPeriodEnd,
}: PaymentFailedEmailProps): RenderedEmail => {
  const subject = 'Payment failed for your WorkSim subscription';
  const isoDate = currentPeriodEnd.toISOString();
  const formattedDate = currentPeriodEnd.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

  const text = `Hello,

We were unable to process your recurring subscription payment for WorkSim.

Your subscription is currently past due. Your access to paid features will remain active until ${formattedDate} (${isoDate}).

To avoid interruption to your simulator access, please visit your account settings to renew your subscription.

If you have questions, please reach out to support.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 32px; }
    h1 { font-size: 20px; font-weight: 600; color: #dc2626; margin-top: 0; }
    p { font-size: 15px; line-height: 1.5; color: #374151; margin-bottom: 20px; }
    .highlight { background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 20px 0; border-radius: 0 4px 4px 0; font-size: 14px; color: #991b1b; }
    .footer { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Payment Failed</h1>
    <p>We were unable to process your recurring subscription payment for WorkSim.</p>
    <div class="highlight">
      Your subscription is now past due. Access to paid features remains active through <strong>${formattedDate}</strong> (${isoDate}).
    </div>
    <p>To keep uninterrupted access to tickets, mentoring, and evaluations, please update your payment details in your settings.</p>
    <div class="footer">
      <p>This is an automated transactional message regarding your WorkSim account.</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html, text };
};
