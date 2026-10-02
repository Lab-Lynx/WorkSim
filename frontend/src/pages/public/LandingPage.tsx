import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  CircleCheck,
  CircleDot,
  CodeXml,
  FolderGit2,
  GitBranch,
  GitPullRequest,
  GraduationCap,
  Layers,
  MessageCircle,
  Send,
  Sparkles,
  SquareTerminal,
  Ticket,
  UserRound,
  Workflow,
  Zap,
} from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ROUTES } from '@/constants';

const STEPS = [
  {
    step: '01',
    title: 'Get a Ticket',
    description: 'Pick a scoped task that mirrors the work on a real engineering team.',
    Icon: Ticket,
  },
  {
    step: '02',
    title: 'Code Locally',
    description: 'Work in your own editor with the tools and habits you already trust.',
    Icon: SquareTerminal,
  },
  {
    step: '03',
    title: 'Push to GitHub',
    description: 'Commit your changes and practice a clean, reviewable workflow.',
    Icon: GitBranch,
  },
  {
    step: '04',
    title: 'Open a PR',
    description: 'Explain your approach, link your work, and ask for a real review.',
    Icon: GitPullRequest,
  },
  {
    step: '05',
    title: 'Get Reviewed',
    description: 'See what shipped well and where your engineering instincts can grow.',
    Icon: CircleCheck,
  },
] as const;

const FEATURES = [
  {
    title: 'Real-World Tickets',
    description:
      'Practice on realistic product requests with clear acceptance criteria and useful constraints.',
    Icon: Layers,
  },
  {
    title: 'AI Mentor Guidance',
    description: 'Get thoughtful nudges when you are stuck without giving away the solution.',
    Icon: Bot,
  },
  {
    title: 'GitHub Workflow',
    description:
      'Build the muscle memory of branches, commits, pull requests, and collaboration.',
    Icon: FolderGit2,
  },
  {
    title: 'Automated Evaluation',
    description:
      'Receive consistent feedback on requirements, quality, testing, and performance.',
    Icon: Zap,
  },
  {
    title: 'Experience Profile',
    description:
      'Keep a grounded record of the work you have practiced and the skills you are developing.',
    Icon: GraduationCap,
  },
  {
    title: 'No Lock-In',
    description:
      'Work in your own editor, use your own tools, and keep your engineering flow intact.',
    Icon: Workflow,
  },
] as const;

export default function LandingPage() {
  useDocumentTitle('WorkSim');

  return (
    <div className="min-h-screen bg-white text-[#10231F] selection:bg-emerald-200 selection:text-emerald-950">
      <header className="border-b border-white/10 bg-[#071B17] text-white">
        <nav
          className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10"
          aria-label="Main navigation"
        >
          <a href="#top" className="flex items-center gap-2.5" aria-label="WorkSim home">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400 text-[#071B17]">
              <CodeXml className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            </span>
            <span className="text-xl font-extrabold tracking-[-0.04em] text-emerald-300">
              WorkSim
            </span>
          </a>

          <div className="hidden items-center gap-9 text-sm font-medium text-emerald-100/70 md:flex">
            <a href="#how-it-works" className="transition-colors hover:text-white">
              How it Works
            </a>
            <a href="#features" className="transition-colors hover:text-white">
              Features
            </a>
            <a href="#credentials" className="transition-colors hover:text-white">
              About Credentials
            </a>
          </div>

          <Link
            to={ROUTES.REGISTER}
            className="rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-bold text-[#071B17] shadow-[0_8px_24px_rgba(52,211,153,0.18)] transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:ring-offset-2 focus:ring-offset-[#071B17]"
          >
            Get Started
          </Link>
        </nav>
      </header>

      <main id="top">
        <section className="overflow-hidden bg-[#071B17] text-white" id="start">
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 pb-24 pt-16 lg:grid-cols-[0.9fr_1.1fr] lg:px-10 lg:pb-32 lg:pt-24">
            <div className="max-w-2xl">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
                <CircleDot className="h-3.5 w-3.5" aria-hidden />
                <span>Practice with purpose</span>
              </div>

              <h1 className="max-w-xl text-5xl font-black leading-[0.98] tracking-[-0.065em] sm:text-6xl lg:text-[5.15rem]">
                Your First Job Before You Get Your First Job.
              </h1>

              <p className="mt-7 max-w-lg text-lg leading-8 text-emerald-100/70">
                Practice the real software engineering workflows that make teams move: tickets,
                branches, pull requests, reviews, and everything between.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  to={ROUTES.REGISTER}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 py-3.5 text-sm font-bold text-[#071B17] transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  <span>Start Building</span>
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-100/25 px-5 py-3.5 text-sm font-bold text-white transition hover:border-emerald-200/60 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  <span>See How It Works</span>
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              </div>

              <p className="mt-6 flex items-center gap-2 text-xs text-emerald-100/45">
                <CircleCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                <span>No polished portfolio required. Just curiosity and a willingness to build.</span>
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-[650px]">
              <div className="rounded-2xl border border-white/15 bg-[#102B25] p-2 shadow-[0_28px_90px_rgba(0,0,0,0.32)]">
                <div className="flex items-center justify-between rounded-t-xl border-b border-white/10 bg-[#0B211D] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#F87171]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#FBBF24]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100/40">
                    workspace / ticket-184
                  </span>
                  <span className="w-10" />
                </div>

                <div className="grid gap-2 p-2 sm:grid-cols-[1fr_1.08fr]">
                  <div className="rounded-xl border border-white/10 bg-[#0B211D] p-4">
                    <div className="mb-5 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-bold text-emerald-100">
                        <Ticket className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                        <span>ENG-184</span>
                      </span>
                      <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-300">
                        IN PROGRESS
                      </span>
                    </div>
                    <h2 className="text-lg font-bold leading-snug text-white">
                      Add pagination to the activity feed
                    </h2>
                    <p className="mt-3 text-xs leading-5 text-emerald-100/55">
                      Keep initial load under 500ms and expose a cursor-based API for older
                      events.
                    </p>
                    <div className="mt-7 border-t border-white/10 pt-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100/35">
                        Acceptance criteria
                      </p>
                      <ul className="mt-3 space-y-2 text-xs text-emerald-100/70">
                        <li className="flex gap-2">
                          <CircleCheck
                            className="h-3.5 w-3.5 shrink-0 text-emerald-400"
                            aria-hidden
                          />
                          <span>Cursor is stable between requests</span>
                        </li>
                        <li className="flex gap-2">
                          <CircleCheck
                            className="h-3.5 w-3.5 shrink-0 text-emerald-400"
                            aria-hidden
                          />
                          <span>Empty states are handled</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <div className="rounded-xl border border-white/10 bg-[#F7FBF9] p-4 text-[#10231F]">
                      <div className="flex items-center gap-2 border-b border-[#DCEAE3] pb-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                          <Sparkles className="h-4 w-4" aria-hidden />
                        </span>
                        <div>
                          <p className="text-xs font-bold">AI Mentor</p>
                          <p className="text-[10px] text-emerald-700">Context-aware guidance</p>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <MessageCircle
                          className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-600"
                          aria-hidden
                        />
                        <p className="text-xs leading-5 text-[#48635A]">
                          Nice direction. Before you push, what happens when the cursor no longer
                          points to a record?
                        </p>
                      </div>
                      <div className="mt-3 ml-5 rounded-lg bg-white p-2.5 text-[10px] leading-4 text-[#6B8178] shadow-sm">
                        Try writing that case as a test first.
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#12372D] p-4 text-white">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-xs font-bold">
                          <GitPullRequest className="h-4 w-4" aria-hidden />
                          <span>Pull request</span>
                        </span>
                        <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[10px] font-bold text-emerald-300">
                          READY
                        </span>
                      </div>
                      <p className="mt-4 text-sm font-semibold">feat: paginate activity feed</p>
                      <div className="mt-3 flex items-center justify-between text-[10px] text-emerald-100/50">
                        <span>8 files changed</span>
                        <span>+142 −38</span>
                      </div>
                      <div className="mt-4 flex items-center justify-between rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-[#071B17]">
                        <span>Submit for review</span>
                        <Send className="h-3.5 w-3.5" aria-hidden />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="bg-white px-6 py-24 lg:px-10 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                A better way to get ready
              </p>
              <h2 className="mt-4 text-4xl font-black tracking-[-0.05em] text-[#10231F] sm:text-5xl">
                Learn the work by doing the work.
              </h2>
              <p className="mt-5 text-lg leading-8 text-[#61756D]">
                The loop is simple. The confidence you build in it is not.
              </p>
            </div>

            <ol className="mt-16 grid gap-8 md:grid-cols-5 md:gap-5">
              {STEPS.map(({ step, title, description, Icon }) => (
                <li key={step} className="relative border-t border-[#DDE9E3] pt-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black tracking-[0.16em] text-emerald-600">
                      {step}
                    </span>
                    <Icon className="h-5 w-5 text-emerald-600" aria-hidden />
                  </div>
                  <h3 className="mt-7 text-base font-extrabold text-[#10231F]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#6B8178]">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="bg-[#F3F8F5] px-6 py-24 lg:px-10 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                  Built around your growth
                </p>
                <h2 className="mt-4 text-4xl font-black tracking-[-0.05em] text-[#10231F] sm:text-5xl">
                  Everything you need to practice with intent.
                </h2>
              </div>
              <p className="max-w-sm text-base leading-7 text-[#61756D]">
                A focused environment for turning “I’ve seen this before” into “I can ship this.”
              </p>
            </div>

            <div className="mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ title, description, Icon }) => (
                <article key={title} className="border-t border-[#CFE0D7] pt-5">
                  <Icon className="h-5 w-5 text-emerald-700" aria-hidden />
                  <h3 className="mt-5 text-lg font-extrabold text-[#10231F]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#61756D]">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="credentials" className="bg-white px-6 py-24 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-2xl bg-[#0D3027] px-7 py-10 text-white sm:px-12 sm:py-14 lg:flex lg:items-center lg:justify-between lg:gap-16">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-emerald-300">
                  <UserRound className="h-4 w-4" aria-hidden />
                  <span className="text-xs font-bold uppercase tracking-[0.18em]">
                    About credentials
                  </span>
                </div>
                <h2 className="mt-5 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                  Practice experience is not a promise of employment.
                </h2>
                <p className="mt-5 text-base leading-7 text-emerald-100/70">
                  WorkSim tracks the work you practice: the tickets you complete, the decisions
                  you make, and the feedback you apply. It does not issue employer-certified
                  credentials or replace professional experience. It is an honest record of
                  momentum you can take into your next conversation.
                </p>
              </div>
              <div className="mt-9 shrink-0 lg:mt-0">
                <Link
                  to={ROUTES.REGISTER}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-5 py-3.5 text-sm font-bold text-[#071B17] transition hover:bg-emerald-300"
                >
                  <span>Start building honestly</span>
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E1ECE6] bg-white px-6 py-9 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 text-sm text-[#71847C] sm:flex-row sm:items-center sm:justify-between">
          <a href="#top" className="flex items-center gap-2 font-extrabold text-[#10231F]">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0D3027] text-emerald-300">
              <CodeXml className="h-4 w-4" aria-hidden />
            </span>
            <span>WorkSim</span>
          </a>
          <p>© {new Date().getFullYear()} WorkSim. Practice experience is not employer certification.</p>
          <div className="flex gap-5">
            <a href="#credentials" className="transition hover:text-emerald-700">
              Credentials note
            </a>
            <Link to={ROUTES.LOGIN} className="transition hover:text-emerald-700">
              Log in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
