export interface VerificationEmailProps {
  verificationUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export const renderVerificationEmail = ({
  verificationUrl,
}: VerificationEmailProps): RenderedEmail => {
  const subject = 'Verify your WorkSim email address';

  const text = `Welcome to WorkSim!

Please verify your email address by visiting the following link:
${verificationUrl}

If you did not create a WorkSim account, please ignore this email.`;

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
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 500; font-size: 15px; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0; }
    .url { word-break: break-all; font-size: 13px; color: #6b7280; }
    .footer { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Verify your email address</h1>
    <p>Welcome to WorkSim! Please confirm your email address to complete your account setup and get started.</p>
    <div>
      <a href="${verificationUrl}" class="btn">Verify Email Address</a>
    </div>
    <p>Or copy and paste this link into your browser:</p>
    <p class="url"><a href="${verificationUrl}">${verificationUrl}</a></p>
    <div class="footer">
      <p>If you did not create an account on WorkSim, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html, text };
};
