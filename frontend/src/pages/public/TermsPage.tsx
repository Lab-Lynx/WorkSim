import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';

export default function TermsPage() {
  useDocumentTitle('Terms of Service | WorkSim');
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-neutral-950 selection:bg-neutral-900/10 flex flex-col">
      <PublicHeader />

      <main id="top" className="flex-1 px-6 py-16 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl prose prose-neutral prose-headings:font-semibold prose-a:text-neutral-950 hover:prose-a:text-neutral-700">
          <h1 className="text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl mb-4">Terms of Service</h1>
          <p className="text-neutral-500 mb-12">Last updated: {date}</p>

          <p>
            Welcome to Work Simulator. By creating an account or using the service, you agree to these Terms. If you don't agree, please don't use Work Simulator.
          </p>

          <h2 className="text-2xl font-semibold mt-10 mb-4">1. What Work Simulator is</h2>
          <p>
            Work Simulator is a practice platform for junior developers. You get realistic tickets, an AI mentor, a real GitHub repository and pull request workflow, and AI-generated feedback and scoring on your work. It is a learning and practice tool. It is not a job, an internship, a certification or a hiring service.
          </p>

          <h2 className="text-2xl font-semibold mt-10 mb-4">2. Your account</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>You must provide accurate information when you register (name, email, password).</li>
            <li>You must verify your email before you can subscribe.</li>
            <li>You are responsible for keeping your password secure and for activity on your account. Tell us right away if you think someone else has accessed it.</li>
            <li>You must be at least 18 to use the service.</li>
            <li>You can log out of all devices at any time from Settings.</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-10 mb-4">3. Subscription and payments</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Work Simulator is a paid monthly subscription, currently 450 ETB per month. The price is shown at checkout before you pay.</li>
            <li>Payments are processed by <strong>Chapa</strong>. We never see or store your card or mobile-money details.</li>
            <li>Your access is activated only after Chapa confirms your payment. If you completed payment and don't see access yet, wait a few minutes and don't pay again.</li>
            <li>Your subscription renews monthly. We send a reminder email about 7 days before renewal and charge at the end of your billing period.</li>
            <li>If a renewal payment fails, your subscription is marked <strong>past due</strong> and we notify you by email. Access still ends when your current paid period ends. There is no extra grace period.</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-10 mb-4">4. Cancellation and refunds</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>You can cancel any time from the Billing page. Cancellation stops future charges.</li>
            <li>After you cancel, you keep access until the end of the period you already paid for. We don't prorate or refund the unused part of a period.</li>
            <li>A canceled subscription can't be resumed. After access ends, you start a new subscription through checkout.</li>
            <li>Refunds are not automatic and are handled manually. If you believe you were charged in error (for example, a duplicate charge), contact us at support@worksim.com and we will review it.</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-10 mb-4">5. GitHub connection and your repositories</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>To use the ticket workflow, you connect your GitHub account through GitHub's official sign-in.</li>
            <li>We ask for the minimum permissions needed to create a starter repository in your account, push to it, and register a webhook so we can see your test results.</li>
            <li>The starter repository is created <strong>in your own GitHub account</strong> and belongs to you. You can disconnect GitHub at any time. Disconnecting keeps your past submissions but blocks you from starting new tickets until you reconnect.</li>
            <li>You are responsible for your GitHub account and for following GitHub's own terms.</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-10 mb-4">6. Tickets, AI mentor and AI evaluation</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Tickets are generated from team-written structures, with the specific wording filled in by AI.</li>
            <li>The AI mentor gives progressive hints rather than finished answers. Using it is how you build the "problem-solving and communication" part of your score.</li>
            <li>Your first submission gets feedback only. Your score is given on the re-review, using a fixed rubric (requirements met, correctness and tests, code quality, and problem-solving and communication).</li>
            <li><strong>AI can be wrong.</strong> Mentor replies, ticket text, feedback and scores are generated by AI and may contain mistakes. Treat them as guidance, not as professional or employer-verified assessment.</li>
            <li><strong>Scores are not credentials.</strong> Your scores and work-sample profile show your practice. We don't certify them, and we don't guarantee that any employer will recognize them or that you will get a job.</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-10 mb-4">7. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Paste a finished answer from elsewhere with no genuine engagement, or otherwise try to game the mentor or scoring system.</li>
            <li>Share your account or sell or resell access to the service.</li>
            <li>Attempt to break, probe or overload the platform, or access other users' data.</li>
            <li>Use the mentor or ticket system to generate harmful, illegal or abusive content.</li>
            <li>Include secrets (API keys, tokens, passwords) or other people's personal data in your code, submissions or mentor chats.</li>
            <li>Use the service to violate any law or anyone's rights.</li>
          </ul>
          <p className="mt-4">We may suspend or end accounts that break these rules.</p>

          <h2 className="text-2xl font-semibold mt-10 mb-4">8. Your content and our content</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Your work.</strong> You keep ownership of the code you write and your repositories. You give us permission to read, process and display your submissions, diffs and mentor chats as needed to run the service: to generate feedback and scores, and to show them back to you.</li>
            <li><strong>Our work.</strong> The Work Simulator platform, ticket structures, scoring rubric, design and branding belong to us. You may not copy or reuse them, except for your own personal practice and portfolio.</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-10 mb-4">9. Availability and changes</h2>
          <p>
            We aim to keep Work Simulator running, but we don't promise it will always be uninterrupted or error-free. Features, templates, pricing and these Terms may change over time. If we make a significant change, we will notify you by email or in the app. Continuing to use the service after a change means you accept it.
          </p>

          <h2 className="text-2xl font-semibold mt-10 mb-4">10. Ending your account</h2>
          <p>
            You can stop using Work Simulator at any time. We may suspend or end your access if you break these Terms or misuse the platform. To request deletion of your account and data, contact us at support@worksim.com.
          </p>

          <h2 className="text-2xl font-semibold mt-10 mb-4">11. Disclaimers and limits of liability</h2>
          <p>
            Work Simulator is provided "as is" and "as available." To the fullest extent allowed by law, we aren't liable for indirect or consequential losses, including lost job opportunities, and our total liability to you is limited to the amount you paid us in the 3 months before the claim. Nothing here limits rights you have under law that cannot be waived.
          </p>

          <h2 className="text-2xl font-semibold mt-10 mb-4">12. Governing law</h2>
          <p>
            These Terms are governed by the laws of Ethiopia. Disputes will be handled in the courts of Addis Ababa, Ethiopia, unless local law says otherwise.
          </p>

          <h2 className="text-2xl font-semibold mt-10 mb-4">13. Contact</h2>
          <p>
            Questions about these Terms? Email us at <a href="mailto:support@worksim.com">support@worksim.com</a>.
          </p>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
