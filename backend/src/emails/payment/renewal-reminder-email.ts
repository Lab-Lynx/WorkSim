export interface RenewalReminderEmailProps {
  currentPeriodEnd: Date;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export const renderRenewalReminderEmail = ({
  currentPeriodEnd,
}: RenewalReminderEmailProps): RenderedEmail => {
  const subject = 'Your WorkSim subscription renews soon';
  const isoDate = currentPeriodEnd.toISOString();
  const formattedDate = currentPeriodEnd.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

  const text = `Hello,

This is a reminder that your WorkSim subscription is scheduled to renew in 7 days on ${formattedDate} (${isoDate}).

You do not need to take any action if you wish to continue your subscription. If you want to make changes or cancel before the renewal date, you can do so in your account settings.

Thank you for practicing with WorkSim!`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 32px; }
    h1 { font-size: 20px; font-weight: 600; color: #111827; margin-top: 0; }
    p { font-size: 15px; line-height: 1.5; color: #374151; margin-bottom: 20px; }
    .highlight { background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 20px 0; border-radius: 0 4px 4px 0; font-size: 14px; color: #1e40af; }
    .footer { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Upcoming Subscription Renewal</h1>
    <p>This is a courtesy reminder that your WorkSim subscription will renew in 7 days.</p>
    <div class="highlight">
      Scheduled renewal date: <strong>${formattedDate}</strong> (${isoDate})
    </div>
    <p>No action is needed if you want your access to continue uninterrupted. If you'd like to review or modify your plan, visit your account settings.</p>
    <div class="footer">
      <p>This is an automated transactional reminder from WorkSim.</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html, text };
};
