import React from 'react';
import { Heart, Activity, Shield, FileText, ArrowRight, Search, AlertCircle } from 'lucide-react';
import AnimateOnScroll from '../components/patient/AnimateOnScroll';

export default function PatientLandingPage({ onNavigate }) {
  return (
    <div className="min-h-screen font-sans selection:bg-brand-100 selection:text-brand-900">
      <PatientNavigation onNavigate={onNavigate} />
      <main>
        <Hero onNavigate={onNavigate} />
        <PatientPaths onNavigate={onNavigate} />
        <Introduction />
        <TestTypes />
        <DoctorQuestions />
        <SupportSection onNavigate={onNavigate} />
      </main>
      <PatientFooter onNavigate={onNavigate} />
    </div>
  );
}

function PatientNavigation({ onNavigate }) {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className="sticky top-0 z-50 bg-warm-50/80 backdrop-blur-md border-b border-warm-200/50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-6 h-6 text-brand-700" />
          <span className="font-serif text-xl font-medium text-brand-900">OpenOnco Patient Guide</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600">
          <button onClick={() => scrollTo('understanding')} className="hover:text-brand-700 transition-colors">Understanding Tests</button>
          <button onClick={() => scrollTo('types')} className="hover:text-brand-700 transition-colors">Types of Diagnostics</button>
          <button onClick={() => scrollTo('questions')} className="hover:text-brand-700 transition-colors">Questions to Ask</button>
        </div>
        <button
          onClick={() => onNavigate('patient-watching')}
          className="bg-brand-700 hover:bg-brand-900 text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors"
        >
          Find a Test
        </button>
      </div>
    </nav>
  );
}

function Hero({ onNavigate }) {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative pt-20 pb-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        <div className="max-w-xl animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-sm font-medium mb-6 border border-brand-100">
            <span className="w-2 h-2 rounded-full bg-brand-500"></span>
            Your Journey, Personalized
          </div>
          <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl leading-[1.1] text-stone-900 mb-6">
            Clarity in your <br />
            <span className="italic text-brand-700">cancer care.</span>
          </h1>
          <p className="text-lg text-stone-600 mb-10 leading-relaxed">
            Molecular diagnostics and liquid biopsies can feel overwhelming. We're here to help you understand your options, so you and your care team can make the best decisions together.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => scrollTo('understanding')}
              className="bg-brand-700 hover:bg-brand-900 text-white px-8 py-4 rounded-full font-medium transition-all flex items-center gap-2"
            >
              Start Learning <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative opacity-0 animate-fade-in-scale">
          <div className="absolute inset-0 bg-brand-100 rounded-[3rem] transform rotate-3 scale-105 -z-10"></div>
          <img
            src="https://images.unsplash.com/photo-1573497620053-ea5300f94f21?q=80&w=2000&auto=format&fit=crop"
            alt="Doctor and patient talking warmly"
            className="rounded-[3rem] shadow-2xl object-cover aspect-[4/3] w-full"
            referrerPolicy="no-referrer"
            loading="lazy"
          />

          {/* Floating badge */}
          <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-3xl shadow-xl max-w-xs border border-stone-100 opacity-0 animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
            <div className="flex items-center gap-4 mb-2">
              <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center">
                <Shield className="w-5 h-5 text-brand-700" />
              </div>
              <p className="font-serif text-lg font-medium text-stone-900">Knowledge is power</p>
            </div>
            <p className="text-sm text-stone-500">Understanding your tumor's unique profile leads to better-targeted treatments.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PatientPaths({ onNavigate }) {
  const paths = [
    {
      title: '"My doctor recommended a test"',
      description: 'Learn about your test, costs & coverage',
      icon: <FileText className="w-6 h-6 text-brand-700" />,
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-200 hover:border-rose-400',
      iconBg: 'bg-rose-100',
      onClick: () => onNavigate('patient-lookup'),
    },
    {
      title: '"I\'m exploring my options"',
      description: 'Find tests that fit your situation & budget',
      icon: <Search className="w-6 h-6 text-emerald-700" />,
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200 hover:border-emerald-400',
      iconBg: 'bg-emerald-100',
      onClick: () => onNavigate('patient-watching'),
    },
    {
      title: '"My insurance denied coverage"',
      description: 'Get help with your appeal',
      icon: <AlertCircle className="w-6 h-6 text-amber-700" />,
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200 hover:border-amber-400',
      iconBg: 'bg-amber-100',
      onClick: () => onNavigate('patient-appeal'),
    },
  ];

  return (
    <section className="py-16 bg-warm-50">
      <div className="max-w-7xl mx-auto px-6">
        <AnimateOnScroll>
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl md:text-4xl text-stone-900 mb-3">How can we help you today?</h2>
            <p className="text-lg text-stone-500">Choose the path that best describes your situation.</p>
          </div>
        </AnimateOnScroll>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {paths.map((path, i) => (
            <AnimateOnScroll key={i} animation="fade-in-up" delay={i * 0.1}>
              <button
                onClick={path.onClick}
                className={`group w-full text-left p-8 bg-white border-2 ${path.borderColor} rounded-3xl hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2`}
              >
                <div className={`w-12 h-12 ${path.iconBg} rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  {path.icon}
                </div>
                <h3 className="font-serif text-xl font-medium text-stone-900 mb-2">{path.title}</h3>
                <p className="text-stone-500">{path.description}</p>
              </button>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

function Introduction() {
  return (
    <section id="understanding" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div className="order-2 md:order-1 relative">
            <div className="grid grid-cols-2 gap-4">
              <img
                src="https://images.unsplash.com/photo-1516549655169-df83a0774514?q=80&w=1000&auto=format&fit=crop"
                alt="Hands holding"
                className="rounded-t-full rounded-b-[3rem] object-cover aspect-[2/3] w-full shadow-lg"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
              <img
                src="https://images.unsplash.com/photo-1579684385127-1ef15d508118?q=80&w=1000&auto=format&fit=crop"
                alt="Medical professional reviewing results"
                className="rounded-b-full rounded-t-[3rem] object-cover aspect-[2/3] w-full shadow-lg mt-12"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
            </div>
          </div>

          <div className="order-1 md:order-2">
            <AnimateOnScroll>
              <h2 className="font-serif text-4xl md:text-5xl text-stone-900 mb-6">
                What are <span className="italic text-brand-700">molecular diagnostics?</span>
              </h2>
            </AnimateOnScroll>
            <div className="space-y-6 text-lg text-stone-600">
              <p>
                Every person is unique, and so is every cancer. Molecular diagnostics are specialized tests that look at the specific genes, proteins, and other molecules in your tumor.
              </p>
              <p>
                Instead of just looking at where the cancer is located (like the lung or breast), these tests look at the <strong>"instruction manual"</strong> of the cancer cells. This helps your doctor understand exactly what is driving the tumor's growth.
              </p>
              <div className="bg-warm-50 p-6 rounded-2xl border border-warm-200 mt-8">
                <h3 className="font-serif text-xl text-stone-900 mb-2 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-brand-600" />
                  What is a Liquid Biopsy?
                </h3>
                <p className="text-base">
                  A liquid biopsy is a simple blood test that can detect tiny pieces of DNA shed by a tumor into the bloodstream. It's often less invasive than a traditional tissue biopsy and can provide rapid, crucial information about your cancer.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TestTypes() {
  const tests = [
    {
      title: "Comprehensive Genomic Profiling (CGP)",
      description: "Looks at hundreds of genes in your tumor to find specific mutations. This helps match you with targeted therapies or clinical trials designed for your exact cancer type.",
      icon: <FileText className="w-6 h-6 text-brand-700" />
    },
    {
      title: "Minimal Residual Disease (MRD)",
      description: "A highly sensitive test used after surgery or treatment to check if any microscopic cancer cells remain in your body. It helps determine if further treatment is needed.",
      icon: <Activity className="w-6 h-6 text-brand-700" />
    },
    {
      title: "Treatment Response Monitoring",
      description: "Tracks how well a treatment is working over time by measuring changes in tumor DNA in your blood. This gives your doctor real-time feedback on your progress.",
      icon: <Heart className="w-6 h-6 text-brand-700" />
    },
    {
      title: "Early Detection",
      description: "Tests designed to find cancer in its earliest stages, sometimes before symptoms appear, by detecting tumor DNA in the blood.",
      icon: <Shield className="w-6 h-6 text-brand-700" />
    }
  ];

  return (
    <section id="types" className="py-24 bg-brand-900 text-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <AnimateOnScroll>
            <h2 className="font-serif text-4xl md:text-5xl mb-6">Types of Diagnostics</h2>
            <p className="text-brand-100 text-lg">
              There are several different types of molecular tests. Your doctor will recommend the right one based on where you are in your treatment journey.
            </p>
          </AnimateOnScroll>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {tests.map((test, index) => (
            <AnimateOnScroll key={index} animation="fade-in-up" delay={index * 0.1}>
              <div className="bg-brand-800/50 border border-brand-700/50 p-8 rounded-3xl hover:bg-brand-800 transition-colors">
                <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mb-6">
                  {test.icon}
                </div>
                <h3 className="font-serif text-2xl mb-3">{test.title}</h3>
                <p className="text-brand-100 leading-relaxed">
                  {test.description}
                </p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

function DoctorQuestions() {
  const questions = [
    "Would a molecular diagnostic test or liquid biopsy be helpful for my specific type of cancer?",
    "Will the results of this test change my treatment plan?",
    "Do we have enough tissue from my previous biopsy, or will I need a new one (or a blood draw)?",
    "How long will it take to get the results back?",
    "Will my insurance cover the cost of this testing? Are there financial assistance programs?",
    "If the test finds a mutation, are there targeted therapies or clinical trials available for me?"
  ];

  return (
    <section id="questions" className="py-24 bg-warm-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-12 gap-16 items-start">
          <div className="lg:col-span-5 lg:sticky lg:top-32">
            <AnimateOnScroll>
              <h2 className="font-serif text-4xl md:text-5xl text-stone-900 mb-6">
                Questions to ask <span className="italic text-brand-700">your doctor.</span>
              </h2>
              <p className="text-lg text-stone-600 mb-8">
                You are your own best advocate. Print or save these questions to bring to your next oncology appointment. It's okay to ask for clarification if you don't understand the medical jargon.
              </p>
              <button
                onClick={() => window.print()}
                className="bg-white border border-stone-200 hover:border-brand-300 text-stone-800 px-6 py-3 rounded-full font-medium transition-all shadow-sm flex items-center gap-2"
              >
                <FileText className="w-4 h-4" /> Print Questions
              </button>
            </AnimateOnScroll>
          </div>

          <div className="lg:col-span-7 space-y-4">
            {questions.map((q, i) => (
              <AnimateOnScroll key={i} animation="slide-in-right" delay={i * 0.1}>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex gap-4 items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-serif font-bold text-lg">
                    {i + 1}
                  </div>
                  <p className="text-stone-800 text-lg pt-1 font-medium">{q}</p>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SupportSection({ onNavigate }) {
  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-50 rounded-full blur-3xl -z-10 opacity-60 translate-x-1/3 -translate-y-1/3"></div>

        <AnimateOnScroll>
          <div className="bg-brand-50 rounded-[3rem] p-8 md:p-16 text-center max-w-5xl mx-auto relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="font-serif text-4xl md:text-5xl text-stone-900 mb-6">
                You are not alone in this.
              </h2>
              <p className="text-lg text-stone-600 max-w-2xl mx-auto mb-10">
                Navigating a cancer diagnosis is challenging, but understanding your tumor's biology is a powerful step forward. We are here to provide clarity and support.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => onNavigate('home')}
                  className="bg-brand-700 hover:bg-brand-900 text-white px-8 py-4 rounded-full font-medium transition-all w-full sm:w-auto"
                >
                  Explore Test Directory
                </button>
                <button
                  className="bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 px-8 py-4 rounded-full font-medium transition-all w-full sm:w-auto cursor-not-allowed opacity-70"
                  title="Coming soon"
                >
                  Read Patient Stories
                </button>
              </div>
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}

function PatientFooter({ onNavigate }) {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="bg-stone-900 text-stone-400 py-12 border-t border-stone-800">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-8">
        <div className="col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="w-6 h-6 text-brand-500" />
            <span className="font-serif text-xl font-medium text-white">OpenOnco</span>
          </div>
          <p className="max-w-sm mb-6">
            Empowering patients with clear, vendor-neutral information about molecular diagnostics and liquid biopsies.
          </p>
        </div>
        <div>
          <h4 className="text-white font-medium mb-4">For Patients</h4>
          <ul className="space-y-2">
            <li><button onClick={() => scrollTo('understanding')} className="hover:text-brand-400 transition-colors">Understanding Tests</button></li>
            <li><button onClick={() => scrollTo('questions')} className="hover:text-brand-400 transition-colors">Questions for your Doctor</button></li>
            <li><button onClick={() => onNavigate('patient-financial-assistance')} className="hover:text-brand-400 transition-colors">Financial Assistance</button></li>
            <li><button onClick={() => scrollTo('understanding')} className="hover:text-brand-400 transition-colors">Glossary of Terms</button></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-medium mb-4">OpenOnco</h4>
          <ul className="space-y-2">
            <li><button onClick={() => onNavigate('about')} className="hover:text-brand-400 transition-colors">About Us</button></li>
            <li><button onClick={() => onNavigate('home')} className="hover:text-brand-400 transition-colors">Test Directory</button></li>
            <li><button onClick={() => onNavigate('home')} className="hover:text-brand-400 transition-colors">For Providers</button></li>
            <li><button onClick={() => onNavigate('about')} className="hover:text-brand-400 transition-colors">Contact</button></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-stone-800 text-sm flex flex-col md:flex-row items-center justify-between">
        <p>&copy; {new Date().getFullYear()} OpenOnco. All rights reserved.</p>
        <p className="mt-2 md:mt-0">This information is for educational purposes and does not replace professional medical advice.</p>
      </div>
    </footer>
  );
}
