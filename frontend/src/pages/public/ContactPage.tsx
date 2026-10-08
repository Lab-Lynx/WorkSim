import { useState } from 'react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight } from 'lucide-react';
export default function ContactPage() {
  useDocumentTitle('Contact Us | WorkSim');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate sending
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-neutral-950 selection:bg-neutral-900/10 flex flex-col">
      <PublicHeader />

      <main id="top" className="flex-1 px-6 py-16 lg:px-8 lg:py-24 max-w-6xl mx-auto w-full">
        <div className="grid md:grid-cols-[1fr_1.2fr] gap-12 lg:gap-20 items-start">
          
          {/* Left side */}
          <div className="space-y-8">
            <h1 className="text-5xl font-semibold tracking-tight text-neutral-950 sm:text-6xl md:text-7xl leading-[1.1]">
              Get in <span className="inline-block w-12 sm:w-20 h-[3px] sm:h-[4px] bg-neutral-950 align-middle ml-2 sm:ml-4 -mt-2"></span> <br/>
              touch with us
            </h1>
            
            <p className="text-base text-neutral-600 max-w-sm leading-relaxed">
              We're here to help! Whether you have a question about our services, need assistance with your account, or want to provide feedback, our team is ready to assist you.
            </p>

            <div className="space-y-6 pt-4">
              <div>
                <p className="text-sm font-medium text-neutral-500 mb-1">Email:</p>
                <p className="text-xl font-medium text-neutral-950">support@worksim.com</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-neutral-500 mb-1">Hours:</p>
                <p className="text-xl font-medium text-neutral-950">Mon–Fri, 9:00–17:00 EAT</p>
                <p className="text-xs font-medium text-neutral-400 mt-2 uppercase tracking-wide">
                  Typical response time: within 1-2 business days
                </p>
              </div>
            </div>

            <div className="pt-4">
              <Button className="rounded-full bg-neutral-950 text-white pl-5 pr-1.5 h-11 flex items-center gap-3 hover:bg-neutral-800 transition-colors">
                <span className="font-medium text-sm">Live Chat</span>
                <span className="flex items-center justify-center bg-white text-neutral-950 rounded-full size-8">
                  <ArrowRight className="size-4" strokeWidth={2.5} />
                </span>
              </Button>
            </div>
          </div>

          {/* Right side form card */}
          <div className="bg-white rounded-[2.5rem] p-8 sm:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            {submitted ? (
              <div className="rounded-2xl bg-green-50 border border-green-100 p-8 text-center animate-in fade-in zoom-in duration-300 h-full flex flex-col items-center justify-center min-h-[400px]">
                <div className="size-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-6">
                  <ArrowRight className="size-8" />
                </div>
                <h3 className="text-2xl font-medium text-green-950 mb-3">Message Sent!</h3>
                <p className="text-green-700/80 mb-8 max-w-sm">
                  Thanks for reaching out! We've received your message and will reply within 1–2 business days.
                </p>
                <Button 
                  variant="outline" 
                  className="rounded-full h-12 px-6"
                  onClick={() => setSubmitted(false)}
                >
                  Send another message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-xs font-semibold text-neutral-500 pl-2">First Name</Label>
                    <Input 
                      id="firstName" 
                      required 
                      placeholder="Enter your first name..." 
                      className="h-12 bg-neutral-50/50 border-0 ring-1 ring-inset ring-neutral-200/60 rounded-xl px-4 text-neutral-950 placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-neutral-950" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-xs font-semibold text-neutral-500 pl-2">Last Name</Label>
                    <Input 
                      id="lastName" 
                      required 
                      placeholder="Enter your last name..." 
                      className="h-12 bg-neutral-50/50 border-0 ring-1 ring-inset ring-neutral-200/60 rounded-xl px-4 text-neutral-950 placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-neutral-950" 
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-semibold text-neutral-500 pl-2">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    required 
                    placeholder="Enter your email address..." 
                    className="h-12 bg-neutral-50/50 border-0 ring-1 ring-inset ring-neutral-200/60 rounded-xl px-4 text-neutral-950 placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-neutral-950" 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="topic" className="text-xs font-semibold text-neutral-500 pl-2">How can we help you?</Label>
                  <select 
                    id="topic" 
                    required 
                    defaultValue=""
                    className="flex h-12 w-full rounded-xl border-0 ring-1 ring-inset ring-neutral-200/60 bg-neutral-50/50 px-4 py-2 text-sm text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="" disabled>Select a topic...</option>
                    <option value="billing">Billing or payment problem</option>
                    <option value="refund">Refund request</option>
                    <option value="login">Can't log in or verify email</option>
                    <option value="github">GitHub or repository issue</option>
                    <option value="mentor">Mentor or scoring concern</option>
                    <option value="bug">Bug report</option>
                    <option value="privacy">Privacy or data request</option>
                    <option value="feedback">Feedback or ideas</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="sr-only">Message</Label>
                  <textarea 
                    id="message" 
                    required 
                    placeholder="Enter your message..." 
                    className="flex min-h-[160px] w-full rounded-2xl border-0 ring-1 ring-inset ring-neutral-200/60 bg-neutral-50/50 p-4 text-sm text-neutral-950 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button 
                    type="submit" 
                    className="rounded-full bg-neutral-950 text-white pl-5 pr-1.5 h-11 flex items-center gap-3 hover:bg-neutral-800 transition-colors"
                    disabled={isSubmitting}
                  >
                    <span className="font-medium text-sm">{isSubmitting ? 'Sending...' : 'Send Message'}</span>
                    <span className="flex items-center justify-center bg-white text-neutral-950 rounded-full size-8">
                      <ArrowRight className="size-4" strokeWidth={2.5} />
                    </span>
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
