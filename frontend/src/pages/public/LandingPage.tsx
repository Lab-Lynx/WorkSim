import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  CircleCheck,
  FolderGit2,
  GitBranch,
  GitPullRequest,
  GraduationCap,
  Layers,
  MoreHorizontal,
  Play,
  Quote,
  Sparkles,
  SquareTerminal,
  Ticket,
  Workflow,
  Zap,
} from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ROUTES } from '@/constants';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';

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
    title: 'Automated Evaluation',
    description:
      'Every submission is scored against a consistent rubric—requirements, code quality, testing, and performance—so feedback stays fair and actionable. See where you met the bar, where you fell short, and what to improve before the next ticket.',
    Icon: Zap,
    className: 'md:col-span-2 md:row-span-2',
    featured: true,
  },
  {
    title: 'AI Mentor Guidance',
    description: 'Get thoughtful nudges when you are stuck without giving away the solution.',
    Icon: Bot,
    className: 'md:col-span-1',
  },
  {
    title: 'GitHub Workflow',
    description:
      'Build the muscle memory of branches, commits, pull requests, and collaboration.',
    Icon: FolderGit2,
    className: 'md:col-span-1',
  },
  {
    title: 'Real-World Tickets',
    description:
      'Practice on realistic product requests with clear acceptance criteria and useful constraints.',
    Icon: Layers,
    className: 'md:col-span-1',
  },
  {
    title: 'Experience Profile',
    description:
      'Keep a grounded record of the work you have practiced and the skills you are developing.',
    Icon: GraduationCap,
    className: 'md:col-span-1',
  },
  {
    title: 'No Lock-In',
    description:
      'Work in your own editor, use your own tools, and keep your engineering flow intact.',
    Icon: Workflow,
    className: 'md:col-span-1',
  },
] as const;

const ORBIT_ICONS = [
  { Icon: Ticket, label: 'Tickets', className: 'top-[8%] left-1/2 -translate-x-1/2' },
  { Icon: GitBranch, label: 'Git', className: 'top-[28%] right-[10%]' },
  { Icon: Bot, label: 'Mentor', className: 'bottom-[28%] right-[8%]' },
  { Icon: GitPullRequest, label: 'PRs', className: 'bottom-[8%] left-1/2 -translate-x-1/2' },
  { Icon: Zap, label: 'Review', className: 'bottom-[28%] left-[8%]' },
  { Icon: FolderGit2, label: 'Repos', className: 'top-[28%] left-[10%]' },
] as const;

const HIGHLIGHTS = [
  {
    quote:
      'Tickets with real acceptance criteria taught me to ask better questions before I start coding.',
    name: 'Maya',
    role: 'Frontend practitioner',
    initials: 'MA',
  },
  {
    quote:
      'Opening PRs every week made the review loop feel normal instead of intimidating.',
    name: 'Jordan',
    role: 'Full-stack learner',
    initials: 'JO',
  },
  {
    quote:
      'The mentor hints nudged me without spoiling the solution. That is how I want to learn.',
    name: 'Sam',
    role: 'Backend practitioner',
    initials: 'SA',
  },
] as const;

const PRACTITIONER_FEATURES = [
  'Unlimited assigned tickets each month',
  'Full AI mentor access with guided hints',
  'Rubric-scored feedback on every submission',
  'Experience profile with public work history',
] as const;

const MENTOR_FEEDBACK = [
  'Nice direction. Before you push, what happens when the cursor no longer points to a record?',
  'Consider using a cursor-based approach instead of offset for better performance on large tables.',
  'Make sure to update the loading state while fetching the next page.',
  'Great job handling the edge case where the requested page is empty.',
] as const;

type BillingCycle = 'monthly' | 'annual';

function priceLabel(cycle: BillingCycle, monthly: number) {
  if (cycle === 'monthly') {
    return { amount: monthly, suffix: '/month' };
  }
  return { amount: monthly * 10, suffix: '/year' };
}

function ScrollReveal({ children, delay = 0, className }: { children: React.ReactNode, delay?: number, className?: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out transform-gpu will-change-transform",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function LandingPage() {
  useDocumentTitle('WorkSim');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const practitionerPrice = priceLabel(billingCycle, 450);

  const [feedbackIndex, setFeedbackIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setFeedbackIndex((prev) => (prev + 1) % MENTOR_FEEDBACK.length);
        setIsAnimating(false);
      }, 500);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-neutral-950 selection:bg-neutral-900/10">
      <PublicHeader />

      <main id="top">
        <section className="px-6 pb-16 pt-14 lg:px-8 lg:pb-24 lg:pt-20" id="start">
          <div className="mx-auto flex max-w-4xl flex-col items-center text-center animate-in fade-in slide-in-from-bottom-3 duration-700">
            <Badge
              variant="secondary"
              className="h-7 rounded-full border-0 bg-white px-3 text-[11px] uppercase tracking-[0.14em] text-neutral-500 shadow-sm"
            >
              Practice with purpose
            </Badge>

            <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-neutral-950 sm:text-5xl lg:text-6xl">
              Your first{' '}
              <em className="font-heading italic font-medium text-neutral-950">job</em> before you
              get your first job.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-neutral-500 sm:text-lg">
              Practice the real software engineering workflows that make teams move: tickets,
              branches, pull requests, reviews, and everything between.
            </p>

            <div className="relative mx-auto mt-12 aspect-square w-full max-w-md animate-in fade-in zoom-in-95 duration-700 delay-150 fill-mode-both">
              <div className="absolute inset-[8%] rounded-full border border-dashed border-neutral-300" />
              <div className="absolute inset-[20%] rounded-full border border-dashed border-neutral-300/80" />
              <div className="absolute inset-[34%] rounded-full border border-dashed border-neutral-300/60" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex size-20 items-center justify-center rounded-3xl bg-neutral-950 shadow-xl shadow-neutral-950/20 transition-transform duration-300 hover:scale-105">
                  <img src="/icon.png" alt="" className="size-12 object-contain invert" />
                </div>
              </div>
              {ORBIT_ICONS.map(({ Icon, label, className }) => (
                <div
                  key={label}
                  className={cn(
                    'absolute flex size-11 items-center justify-center rounded-2xl border border-neutral-200 bg-white shadow-sm',
                    className,
                  )}
                  title={label}
                >
                  <Icon className="size-5 text-neutral-700" aria-hidden />
                  <span className="sr-only">{label}</span>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
              <Button
                size="lg"
                className="h-11 rounded-full bg-neutral-950 px-6 text-white hover:bg-neutral-800"
                asChild
              >
                <Link to={ROUTES.REGISTER}>
                  Start Building
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 rounded-full border-neutral-300 bg-white px-6 text-neutral-950 hover:bg-neutral-100"
                asChild
              >
                <a href="#how-it-works">
                  <Play data-icon="inline-start" className="size-3.5 fill-current" />
                  See How It Works
                </a>
              </Button>
            </div>

            <p className="mt-5 flex items-center gap-2 text-xs text-neutral-500">
              <CircleCheck className="size-3.5 text-neutral-950" aria-hidden />
              No polished portfolio required. Just curiosity and a willingness to build.
            </p>
          </div>
        </section>

        <section id="how-it-works" className="px-6 py-16 lg:px-8 lg:py-24">
          <ScrollReveal className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <Badge
                variant="outline"
                className="h-7 rounded-full border-neutral-200 bg-white px-3 text-neutral-500"
              >
                A better way to get ready
              </Badge>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
                Learn the work by doing the{' '}
                <em className="font-heading italic font-medium">work</em>.
              </h2>
              <p className="mt-4 text-base leading-7 text-neutral-500">
                The loop is simple. The confidence you build in it is not.
              </p>

              <ul className="mt-8 space-y-4">
                {STEPS.slice(0, 3).map(({ step, title, description, Icon }) => (
                  <li key={step} className="flex gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-2xl bg-neutral-200/80 text-neutral-950">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div>
                      <p className="font-medium text-neutral-950">{title}</p>
                      <p className="mt-0.5 text-sm leading-6 text-neutral-500">{description}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  className="rounded-full bg-neutral-950 px-5 text-white hover:bg-neutral-800"
                  asChild
                >
                  <Link to={ROUTES.REGISTER}>
                    Get Started
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full border-neutral-300 bg-white px-5 text-neutral-950 hover:bg-neutral-100"
                  asChild
                >
                  <a href="#pricing">
                    <Play data-icon="inline-start" className="size-3.5 fill-current" />
                    View pricing
                  </a>
                </Button>
              </div>
            </div>

            <Card 
              className="relative overflow-hidden rounded-[2rem] border-0 p-8 shadow-xl flex flex-col justify-between -rotate-2 hover:rotate-0 transition duration-500 ease-out hover:shadow-2xl transform-gpu will-change-transform"
              style={{ backgroundColor: '#111111' }}
            >
              {/* Background gradient */}
              <div 
                className="absolute inset-0 opacity-60"
                style={{ 
                  background: 'radial-gradient(circle at 0% 20%, #f97316 0%, #9a3412 40%, transparent 70%)' 
                }}
              />
              
              <CardContent className="relative flex flex-col h-full p-0">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-xl bg-white text-neutral-950">
                      <Ticket className="size-4" aria-hidden />
                    </span>
                    <span className="font-medium text-white/90">ENG-184</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10">
                      Active ticket <ChevronDown className="size-3" />
                    </button>
                    <button className="flex size-[28px] items-center justify-center rounded-full border border-white/20 text-white/80 transition-colors hover:bg-white/10">
                      <MoreHorizontal className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Big Number */}
                <div className="mt-16 flex items-start gap-2">
                  <span className="text-[5.5rem] leading-none font-light tracking-tight text-white">96%</span>
                  <ArrowUpRight className="mt-3 size-7 text-orange-400 stroke-[2.5]" />
                </div>

                {/* Text Content */}
                <div className="mt-16 space-y-4">
                  <p className="text-xl font-medium leading-snug text-white/90">
                    Add pagination to the activity feed
                  </p>
                  <p 
                    className={cn(
                      "text-sm leading-relaxed text-white/50 transition-all duration-500 min-h-[60px]",
                      isAnimating ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0"
                    )}
                  >
                    {MENTOR_FEEDBACK[feedbackIndex]}
                  </p>
                </div>

                {/* Pagination Dots */}
                <div className="mt-8 flex gap-2">
                  <div className="h-1 flex-1 rounded-full bg-white/20" />
                  <div className="h-1 flex-1 rounded-full bg-white" />
                  <div className="h-1 flex-1 rounded-full bg-white/20" />
                  <div className="h-1 flex-1 rounded-full bg-white/20" />
                  <div className="h-1 flex-1 rounded-full bg-white/20" />
                  <div className="h-1 flex-1 rounded-full bg-white/20" />
                  <div className="h-1 flex-1 rounded-full bg-white/20" />
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>
        </section>

        <section id="pricing" className="px-6 py-16 lg:px-8 lg:py-24">
          <ScrollReveal className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <Badge
                variant="outline"
                className="h-7 rounded-full border-neutral-200 bg-white px-3 text-neutral-500"
              >
                Pricing
              </Badge>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
                Plans for your{' '}
                <em className="font-heading italic font-medium">practice</em>
              </h2>
              <p className="mt-3 text-base text-neutral-500">
                Start exploring free, then unlock the full Practitioner track when you are ready to
                ship every week.
              </p>

              <div
                className="mx-auto mt-8 inline-flex rounded-full border border-neutral-200 bg-white p-1"
                role="group"
                aria-label="Billing cycle"
              >
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={cn(
                    'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                    billingCycle === 'monthly'
                      ? 'bg-neutral-950 text-white'
                      : 'text-neutral-500 hover:text-neutral-950',
                  )}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={cn(
                    'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                    billingCycle === 'annual'
                      ? 'bg-neutral-950 text-white'
                      : 'text-neutral-500 hover:text-neutral-950',
                  )}
                >
                  Annually
                </button>
              </div>
            </div>

            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              <Card className="rounded-3xl border-0 bg-gradient-to-br from-white to-neutral-200 shadow-none ring-0">
                <CardHeader className="gap-3">
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-neutral-950 text-white">
                    <Sparkles className="size-5" aria-hidden />
                  </span>
                  <div>
                    <CardTitle className="text-xl font-semibold text-neutral-950">Explorer</CardTitle>
                    <CardDescription className="mt-1 text-neutral-500">
                      For getting a feel for the WorkSim loop
                    </CardDescription>
                  </div>
                  <p className="pt-2">
                    <span className="text-4xl font-semibold tracking-tight text-neutral-950">
                      0 ETB
                    </span>
                    <span className="ml-1 text-sm text-neutral-500">
                      /{billingCycle === 'monthly' ? 'month' : 'year'}
                    </span>
                  </p>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="secondary"
                    className="w-full rounded-full bg-white text-neutral-950 hover:bg-neutral-100"
                    asChild
                  >
                    <Link to={ROUTES.REGISTER}>Get Started</Link>
                  </Button>
                  <div className="my-5 border-t border-neutral-300/80" />
                  <p className="mb-3 text-sm font-semibold text-neutral-950">Features</p>
                  <ul className="space-y-2.5">
                    {['Create your account', 'Browse the practice workflow', 'Sample ticket preview'].map(
                      (item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-neutral-500">
                          <Check className="mt-0.5 size-4 shrink-0 text-neutral-950" aria-hidden />
                          <span>{item}</span>
                        </li>
                      ),
                    )}
                  </ul>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden rounded-3xl border-0 bg-neutral-950 text-white shadow-lg shadow-neutral-950/20 ring-0">
                <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-orange-600/30 blur-3xl" />
                <CardHeader className="relative gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-white/10 text-white">
                      <Ticket className="size-5" aria-hidden />
                    </span>
                    <Badge className="rounded-full border-0 bg-white/10 text-white hover:bg-white/10">
                      Popular
                    </Badge>
                  </div>
                  <div>
                    <CardTitle className="text-xl font-semibold text-white">Practitioner</CardTitle>
                    <CardDescription className="mt-1 text-white/55">
                      For shipping real tickets every month
                    </CardDescription>
                  </div>
                  <p className="pt-2">
                    <span className="text-4xl font-semibold tracking-tight text-white">
                      {practitionerPrice.amount} ETB
                    </span>
                    <span className="ml-1 text-sm text-white/50">{practitionerPrice.suffix}</span>
                  </p>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full rounded-full bg-white text-neutral-950 hover:bg-neutral-100"
                    asChild
                  >
                    <Link to={ROUTES.REGISTER}>Subscribe Now</Link>
                  </Button>
                  <div className="my-5 border-t border-white/10" />
                  <p className="mb-3 text-sm font-semibold text-white">Features</p>
                  <ul className="space-y-2.5">
                    {PRACTITIONER_FEATURES.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-white/65">
                        <Check className="mt-0.5 size-4 shrink-0 text-white" aria-hidden />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border border-neutral-200/60 bg-white shadow-sm ring-0">
                <CardHeader className="gap-3">
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-neutral-950 text-white">
                    <GraduationCap className="size-5" aria-hidden />
                  </span>
                  <div>
                    <CardTitle className="text-xl font-semibold text-neutral-950">Cohort</CardTitle>
                    <CardDescription className="mt-1 text-neutral-500">
                      For schools and learning groups
                    </CardDescription>
                  </div>
                  <p className="pt-2">
                    <span className="text-4xl font-semibold tracking-tight text-neutral-950">
                      Custom
                    </span>
                  </p>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="secondary"
                    className="w-full rounded-full bg-neutral-100 text-neutral-950 hover:bg-neutral-200"
                    asChild
                  >
                    <Link to={ROUTES.REGISTER}>Talk to us</Link>
                  </Button>
                  <div className="my-5 border-t border-neutral-300/80" />
                  <p className="mb-3 text-sm font-semibold text-neutral-950">Features</p>
                  <ul className="space-y-2.5">
                    {[
                      'Everything in Practitioner',
                      'Shared cohort progress',
                      'Custom onboarding support',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-neutral-500">
                        <Check className="mt-0.5 size-4 shrink-0 text-neutral-950" aria-hidden />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </ScrollReveal>
        </section>

        <section id="features" className="px-6 py-16 lg:px-8 lg:py-24">
          <ScrollReveal className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <Badge
                variant="outline"
                className="h-7 rounded-full border-neutral-200 bg-white px-3 text-neutral-500"
              >
                Built around your growth
              </Badge>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
                Everything you need to practice with{' '}
                <em className="font-heading italic font-medium">intent</em>.
              </h2>
              <p className="mt-3 text-base text-neutral-500">
                A focused environment for turning “I’ve seen this before” into “I can ship this.”
              </p>
            </div>

            <div className="mt-12 grid auto-rows-[minmax(11rem,auto)] grid-cols-1 gap-4 md:grid-cols-3">
              {FEATURES.map(({ title, description, Icon, className, ...rest }) => {
                const featured = 'featured' in rest && rest.featured;

                return (
                  <div
                    key={title}
                    className={cn(
                      'rounded-[1.75rem] border border-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
                      featured
                        ? 'flex flex-col gap-5 overflow-hidden p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6'
                        : 'flex flex-col justify-between p-6',
                      className,
                    )}
                  >
                    {featured ? (
                      <>
                        <div className="flex shrink-0 justify-center sm:w-[42%] sm:justify-start">
                          <img
                            src="/orb.gif"
                            alt=""
                            className="h-36 w-36 object-contain sm:h-44 sm:w-44 lg:h-52 lg:w-52 ml-8"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-neutral-950 text-white">
                            <Icon className="size-5" aria-hidden />
                          </span>
                          <h3 className="font-heading text-xl font-medium tracking-tight text-neutral-950 md:text-2xl">
                            {title}
                          </h3>
                          <p className="mt-3 text-sm leading-6 text-neutral-500 md:text-base md:leading-7">
                            {description}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div>
                        <span className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-neutral-950 text-white">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <h3 className="font-heading text-xl font-medium tracking-tight text-neutral-950">
                          {title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-neutral-500">{description}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollReveal>
        </section>

        <section
          id="testimonials"
          aria-labelledby="testimonials-heading"
          className="border-y border-neutral-200 bg-[#F5F5F5] px-6 py-16 lg:px-8 lg:py-24"
        >
          <ScrollReveal className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                From practitioners
              </p>
              <h2
                id="testimonials-heading"
                className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl"
              >
                What people notice after a few{' '}
                <em className="font-heading italic font-medium">tickets</em>.
              </h2>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-10">
              {HIGHLIGHTS.map((item) => (
                <figure key={item.name} className="flex flex-col gap-6">
                  <Quote className="size-8 text-neutral-300" aria-hidden />
                  <blockquote className="text-base leading-7 text-neutral-600 text-pretty">
                    “{item.quote}”
                  </blockquote>
                  <figcaption className="mt-auto flex items-center gap-3 border-t border-neutral-200 pt-5">
                    <Avatar
                      fallback={item.initials}
                      className="size-9 border-neutral-200 bg-white text-xs text-neutral-950"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-950">{item.name}</p>
                      <p className="truncate text-xs text-neutral-500">{item.role}</p>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>

            <div className="mt-12 flex justify-center gap-3">
              <Button
                className="rounded-full bg-neutral-950 px-5 text-white hover:bg-neutral-800"
                asChild
              >
                <Link to={ROUTES.REGISTER}>
                  Get Started
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button
                variant="outline"
                className="rounded-full border-neutral-300 bg-white px-5 text-neutral-950 hover:bg-neutral-100"
                asChild
              >
                <a href="#credentials">About credentials</a>
              </Button>
            </div>
          </ScrollReveal>
        </section>

        <section id="credentials" className="px-6 pb-16 lg:px-8 lg:pb-24">
          <ScrollReveal className="mx-auto max-w-6xl">
            <Card className="relative overflow-hidden rounded-[2rem] border-0 bg-neutral-950 text-white shadow-none ring-0">
              <div className="pointer-events-none absolute -right-16 -top-24 size-56 rounded-full bg-white/30 blur-3xl" />
              <CardContent className="relative grid gap-10 p-8 sm:p-10 lg:grid-cols-[1.2fr_0.8fr] lg:p-12">
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                    Practice experience is not a promise of employment.
                  </h2>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-white/60 sm:text-base">
                    WorkSim tracks the work you practice: the tickets you complete, the decisions
                    you make, and the feedback you apply. It does not issue employer-certified
                    credentials or replace professional experience. It is an honest record of
                    momentum you can take into your next conversation.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Button
                      className="rounded-full bg-white text-neutral-950 hover:bg-neutral-100"
                      asChild
                    >
                      <Link to={ROUTES.REGISTER}>
                        Start building honestly
                        <ArrowRight data-icon="inline-end" />
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                      asChild
                    >
                      <a href="#pricing">View Pricing</a>
                    </Button>
                  </div>
                </div>

                <ul className="grid content-center gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  {[
                    'Real tickets with clear criteria',
                    'GitHub-native workflow practice',
                    'AI mentor that guides, not spoils',
                    'Rubric feedback you can act on',
                    'Experience profile you control',
                    'No lock-in to a proprietary IDE',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-white/75">
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-white" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </ScrollReveal>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
