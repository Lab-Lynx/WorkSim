import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';

export default function PrivacyPage() {
  useDocumentTitle('Privacy Policy | WorkSim');
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-neutral-950 selection:bg-neutral-900/10 flex flex-col">
      <PublicHeader />

      <main id="top" className="flex-1 px-6 py-16 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl prose prose-neutral prose-headings:font-semibold prose-a:text-neutral-950 hover:prose-a:text-neutral-700">
          <h1 className="text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl mb-4">Privacy Policy</h1>
          <p className="text-neutral-500 mb-12">Last updated: {date}</p>

          <p>
            Your privacy matters to us. This page explains what we collect, why, who we share it with, and the choices you have.
          </p>

          <h2 className="text-2xl font-semibold mt-10 mb-4">1. What we collect</h2>
          
          <h3 className="text-lg font-semibold mt-6 mb-2">Account information</h3>
          <ul className="list-disc pl-6 space-y-2 mb-6">
            <li>Your name, email address and a hashed password. We never store your password in readable form.</li>
            <li>Whether your email is verified.</li>
          </ul>

          <h3 className="text-lg font-semibold mt-6 mb-2">Subscription and payment information</h3>
          <ul className="list-disc pl-6 space-y-2 mb-6">
            <li>Your subscription status, billing period dates, and payment records (amount, currency, status, date).</li>
            <li>Payments are handled by Chapa. We don't collect or store your card or mobile-money details.</li>
          </ul>

          <h3 className="text-lg font-semibold mt-6 mb-2">GitHub information</h3>
          <ul className="list-disc pl-6 space-y-2 mb-6">
            <li>When you connect GitHub: your GitHub username and an access token that lets us create your starter repository, push to it and register a webhook.</li>
            <li>Information about your repository, pull requests, code changes (diffs) and automated test results.</li>
          </ul>

          <h3 className="text-lg font-semibold mt-6 mb-2">Your work on the platform</h3>
          <ul className="list-disc pl-6 space-y-2 mb-6">
            <li>Tickets assigned to you, your submissions, AI feedback, scores and rubric breakdowns.</li>
            <li>Your full mentor chat transcript for each ticket.</li>
          </ul>

          <h3 className="text-lg font-semibold mt-6 mb-2">Technical information</h3>
          <ul className="list-disc pl-6 space-y-2 mb-6">
            <li>Session data needed to keep you logged in, such as secure cookies and hashed refresh tokens.</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-10 mb-4">2. How we use it</h2>
          <ul className="list-disc pl-6 space-y-2 mb-6">
            <li>To create and run your account and keep you signed in.</li>
            <li>To process your subscription and send billing reminders and payment notices.</li>
            <li>To create your starter repository and track your pull requests and test results.</li>
            <li>To generate tickets, mentor replies, feedback and scores.</li>
            <li>To send transactional emails (verification, password reset, billing).</li>
            <li>To keep the platform secure and fix problems.</li>
          </ul>
          <p>We do <strong>not</strong> sell your personal data, and we don't use it for third-party advertising.</p>

          <h2 className="text-2xl font-semibold mt-10 mb-4">3. AI processing</h2>
          <p>To power the mentor, ticket generation and evaluation, relevant content is sent to AI providers:</p>
          <ul className="list-disc pl-6 space-y-2 mb-6 mt-4">
            <li><strong>Google Gemini</strong> for ticket wording and the AI mentor.</li>
            <li><strong>Groq</strong> for the evaluator, which reads your code changes, test results and mentor transcript.</li>
          </ul>
          <p>
            This content can include your code, ticket details and mentor messages. <strong>Please don't put passwords, API keys, tokens or other people's personal information into your code or mentor chats.</strong>
          </p>

          <h2 className="text-2xl font-semibold mt-10 mb-4">4. Who we share data with</h2>
          <p>We share data only with service providers who help us run Work Simulator:</p>
          <div className="overflow-x-auto mt-4 mb-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-300">
                  <th className="py-2 pr-4 font-medium">Provider</th>
                  <th className="py-2 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-neutral-200"><td className="py-2 pr-4">Chapa</td><td className="py-2">Payment processing</td></tr>
                <tr className="border-b border-neutral-200"><td className="py-2 pr-4">GitHub</td><td className="py-2">Repository creation, pull requests, test results</td></tr>
                <tr className="border-b border-neutral-200"><td className="py-2 pr-4">Google (Gemini)</td><td className="py-2">Ticket generation and AI mentor</td></tr>
                <tr className="border-b border-neutral-200"><td className="py-2 pr-4">Groq</td><td className="py-2">AI evaluation</td></tr>
                <tr className="border-b border-neutral-200"><td className="py-2 pr-4">Resend / Email Provider</td><td className="py-2">Verification, reset and billing emails</td></tr>
                <tr className="border-b border-neutral-200"><td className="py-2 pr-4">Vercel / Supabase</td><td className="py-2">Hosting and database</td></tr>
              </tbody>
            </table>
          </div>
          <p>We may also disclose information if required by law or to protect our users and platform.</p>

          <h2 className="text-2xl font-semibold mt-10 mb-4">5. Cookies</h2>
          <p>We use essential cookies to keep you signed in (secure, httpOnly access and refresh cookies). We don't use advertising cookies.</p>

          <h2 className="text-2xl font-semibold mt-10 mb-4">6. Security</h2>
          <ul className="list-disc pl-6 space-y-2 mb-6">
            <li>Passwords are hashed with bcrypt.</li>
            <li>Refresh tokens are stored hashed and rotated on every use.</li>
            <li>Our GitHub access is limited to the minimum permissions we need, and tokens are never written to logs.</li>
            <li>No online service is 100% secure, so please use a strong, unique password.</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-10 mb-4">7. How long we keep data</h2>
          <ul className="list-disc pl-6 space-y-2 mb-6">
            <li>Account, submission, feedback and mentor chat data is kept while your account exists.</li>
            <li>Payment and subscription records are kept for accounting and legal purposes.</li>
            <li>Disconnecting GitHub does not delete your past submissions.</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-10 mb-4">8. Your choices and rights</h2>
          <p>You can:</p>
          <ul className="list-disc pl-6 space-y-2 mb-6 mt-2">
            <li>Update your name and change your password in Settings.</li>
            <li>Log out of all devices.</li>
            <li>Disconnect GitHub, and revoke our access in your GitHub settings at any time.</li>
            <li>Cancel your subscription from the Billing page.</li>
            <li>Ask us to access, correct or delete your data by emailing support@worksim.com. We will respond within 30 days.</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-10 mb-4">9. Children</h2>
          <p>Work Simulator is not intended for anyone under 18. If we learn we collected data from a minor, we will delete it.</p>

          <h2 className="text-2xl font-semibold mt-10 mb-4">10. Changes to this policy</h2>
          <p>We may update this policy. If we make significant changes, we will notify you by email or in the app and update the date above.</p>

          <h2 className="text-2xl font-semibold mt-10 mb-4">11. Contact</h2>
          <p>Privacy questions or requests: <a href="mailto:support@worksim.com">support@worksim.com</a>.</p>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
