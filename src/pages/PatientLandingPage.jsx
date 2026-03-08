import React, { useState } from 'react';
import { Heart, Activity, Shield, FileText, ArrowRight, Search, MessageCircle, Stethoscope } from 'lucide-react';
import AnimateOnScroll from '../components/patient/AnimateOnScroll';

const CANCER_TYPES = [
  { id: 'colorectal', label: 'Colorectal' },
  { id: 'breast', label: 'Breast' },
  { id: 'lung', label: 'Lung' },
  { id: 'bladder', label: 'Bladder' },
  { id: 'ovarian', label: 'Ovarian' },
  { id: 'prostate', label: 'Prostate' },
  { id: 'pancreatic', label: 'Pancreatic' },
  { id: 'melanoma', label: 'Melanoma' },
  { id: 'other-solid', label: 'Other' },
];

const CANCER_STAGES = [
  { id: 'stage-1', label: 'Stage I' },
  { id: 'stage-2', label: 'Stage II' },
  { id: 'stage-3', label: 'Stage III' },
  { id: 'stage-4', label: 'Stage IV' },
  { id: 'not-sure', label: 'Not sure' },
];

export default function PatientLandingPage({ onNavigate }) {
  const [cancerType, setCancerType] = useState(null);
  const [stage, setStage] = useState(null);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  // Navigate to wizard with pre-filled context
  const navigateWithContext = (page) => {
    // Store in sessionStorage so App.jsx can pass to wizards
    if (cancerType || stage) {
      sessionStorage.setItem('openonco-patient-context', JSON.stringify({ cancerType, stage }));
    }
    onNavigate(page);
  };

  return (
    <div className="min-h-screen font-sans selection:bg-brand-100 selection:text-brand-900 bg-warm-50">
      <PatientNavigation onNavigate={onNavigate} scrollTo={scrollTo} />
      <main>
        <Hero onNavigate={onNavigate} />
        <PatientIntake
          cancerType={cancerType}
          setCancerType={setCancerType}
          stage={stage}
          setStage={setStage}
        />
        <DoctorRecommended onNavigate={navigateWithContext} />
        <FindTheRightTest onNavigate={navigateWithContext} />
        <TalkToYourDoctor onNavigate={navigateWithContext} />
      </main>
      <PatientFooter onNavigate={onNavigate} scrollTo={scrollTo} />
    </div>
  );
}

function PatientNavigation({ onNavigate, scrollTo }) {
  return (
    <nav className="sticky top-0 z-50 bg-warm-50/80 backdrop-blur-md border-b border-warm-200/50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-6 h-6 text-brand-700" />
          <span className="font-serif text-xl font-medium text-brand-900">OpenOnco</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600">
          <button onClick={() => onNavigate('patient-mrd-info')} className="hover:text-brand-700 transition-colors">What is MRD?</button>
          <button onClick={() => scrollTo('doctor-recommended')} className="hover:text-brand-700 transition-colors">Paying for a Test</button>
          <button onClick={() => scrollTo('find-test')} className="hover:text-brand-700 transition-colors">Find a Test</button>
          <button onClick={() => scrollTo('talk-to-doctor')} className="hover:text-brand-700 transition-colors">Talk to Your Doctor</button>
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
  return (
    <section className="relative pt-16 pb-20 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        <div className="max-w-xl animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-sm font-medium mb-6 border border-brand-100">
            <Heart className="w-3.5 h-3.5" />
            A nonprofit making MRD accessible to all patients
          </div>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.1] text-stone-900 mb-6">
            You finished treatment. <br />
            <span className="italic text-brand-700">Now let's keep watch.</span>
          </h1>
          <p className="text-lg text-stone-600 mb-4 leading-relaxed">
            There's a new technology called <strong>MRD testing</strong> that lets you and your care team monitor for any recurrence with a simple, regular blood test — so you can be proactive about resuming treatment if it's ever needed.
          </p>
          <p className="text-stone-500 mb-10">
            OpenOnco is a nonprofit with one mission: making MRD monitoring accessible to every cancer patient, regardless of insurance or income.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => onNavigate('patient-mrd-info')}
              className="bg-brand-700 hover:bg-brand-900 text-white px-8 py-4 rounded-full font-medium transition-all flex items-center gap-2"
            >
              What is MRD Testing? <ArrowRight className="w-4 h-4" />
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
          <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-3xl shadow-xl max-w-xs border border-stone-100 opacity-0 animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
            <div className="flex items-center gap-4 mb-2">
              <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center">
                <Shield className="w-5 h-5 text-brand-700" />
              </div>
              <p className="font-serif text-lg font-medium text-stone-900">Knowledge is power</p>
            </div>
            <p className="text-sm text-stone-500">A simple blood test can detect cancer recurrence months before a scan would.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Patient Intake — cancer type + stage ─── */
function PatientIntake({ cancerType, setCancerType, stage, setStage }) {
  return (
    <section id="your-situation" className="py-12 bg-white border-y border-stone-200">
      <div className="max-w-4xl mx-auto px-6">
        <AnimateOnScroll>
          <div className="text-center mb-8">
            <h2 className="font-serif text-2xl md:text-3xl text-stone-900 mb-2">Tell us about your situation</h2>
            <p className="text-stone-500">This personalizes everything below — the tools, the evidence, and the recommendations.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Cancer type */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-3">What were you treated for?</label>
              <div className="flex flex-wrap gap-2">
                {CANCER_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setCancerType(type.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                      cancerType === type.id
                        ? 'bg-brand-700 text-white border-brand-700'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300 hover:text-brand-700'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stage */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-3">What stage?</label>
              <div className="flex flex-wrap gap-2">
                {CANCER_STAGES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStage(s.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                      stage === s.id
                        ? 'bg-brand-700 text-white border-brand-700'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300 hover:text-brand-700'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {cancerType && stage && (
            <div className="mt-6 text-center">
              <p className="text-sm text-brand-700 font-medium">
                Got it — we'll personalize your results for {CANCER_TYPES.find(t => t.id === cancerType)?.label} cancer, {CANCER_STAGES.find(s => s.id === stage)?.label}.
              </p>
            </div>
          )}
        </AnimateOnScroll>
      </div>
    </section>
  );
}

/* ─── Section 1: Your Doctor is Recommending a Test ─── */
function DoctorRecommended({ onNavigate }) {
  return (
    <section id="doctor-recommended" className="py-24 bg-warm-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <AnimateOnScroll>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-sm font-medium mb-6 border border-rose-200">
                <FileText className="w-3.5 h-3.5" />
                Your doctor recommends a test
              </div>
              <h2 className="font-serif text-4xl md:text-5xl text-stone-900 mb-6">
                Let's figure out <span className="italic text-brand-700">how to pay for it.</span>
              </h2>
              <p className="text-lg text-stone-600 mb-6 leading-relaxed">
                Your oncologist has recommended a specific MRD test. Great — that's an important step. Now you need to understand the costs, check your insurance coverage, and find financial assistance if you need it.
              </p>
              <p className="text-stone-500 mb-8">
                Tell us which test your doctor recommended and we'll show you coverage details, out-of-pocket estimates, and financial assistance programs you may qualify for.
              </p>
              <button
                onClick={() => onNavigate('patient-lookup')}
                className="bg-brand-700 hover:bg-brand-900 text-white px-8 py-4 rounded-full font-medium transition-all flex items-center gap-2"
              >
                Look Up My Test <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </AnimateOnScroll>

          <AnimateOnScroll animation="fade-in-up" delay={0.1}>
            <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
              <h3 className="font-serif text-xl text-stone-900 mb-6">What we'll help you find:</h3>
              <ul className="space-y-5">
                {[
                  { icon: <Shield className="w-5 h-5 text-brand-600" />, title: 'Insurance coverage', desc: 'Whether your plan covers the test and what prior authorization you may need' },
                  { icon: <FileText className="w-5 h-5 text-brand-600" />, title: 'Cost estimates', desc: 'What you might pay out-of-pocket, with or without insurance' },
                  { icon: <Heart className="w-5 h-5 text-brand-600" />, title: 'Financial assistance', desc: 'Programs from test manufacturers and nonprofits that can reduce or eliminate your costs' },
                ].map((item, i) => (
                  <li key={i} className="flex gap-4">
                    <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <p className="font-medium text-stone-900">{item.title}</p>
                      <p className="text-sm text-stone-500">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </AnimateOnScroll>
        </div>
      </div>
    </section>
  );
}

/* ─── Section 3: Find the Right Test ─── */
function FindTheRightTest({ onNavigate }) {
  return (
    <section id="find-test" className="py-24 bg-brand-900 text-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <AnimateOnScroll animation="fade-in-up" delay={0.1}>
            <div className="bg-brand-800/50 border border-brand-700/50 rounded-3xl p-8 order-2 lg:order-1">
              <h3 className="font-serif text-xl mb-6">We'll match you based on:</h3>
              <ul className="space-y-5">
                {[
                  { icon: <Stethoscope className="w-5 h-5 text-brand-300" />, title: 'Your cancer type', desc: 'Different tests are validated for different cancers — we know which ones' },
                  { icon: <Activity className="w-5 h-5 text-brand-300" />, title: 'Your treatment stage', desc: 'Whether you\'re post-surgery, post-chemo, or in active surveillance' },
                  { icon: <Shield className="w-5 h-5 text-brand-300" />, title: 'Your insurance', desc: 'Which tests are covered by your specific plan' },
                  { icon: <Heart className="w-5 h-5 text-brand-300" />, title: 'Financial assistance', desc: 'Tests with the best patient support programs for your situation' },
                ].map((item, i) => (
                  <li key={i} className="flex gap-4">
                    <div className="w-10 h-10 bg-brand-700/50 rounded-xl flex items-center justify-center flex-shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <p className="font-medium text-white">{item.title}</p>
                      <p className="text-sm text-brand-200">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </AnimateOnScroll>

          <AnimateOnScroll className="order-1 lg:order-2">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-800 text-brand-200 text-sm font-medium mb-6 border border-brand-700">
                <Search className="w-3.5 h-3.5" />
                Not sure which test?
              </div>
              <h2 className="font-serif text-4xl md:text-5xl mb-6">
                Find the right test for <span className="italic text-brand-300">your situation.</span>
              </h2>
              <p className="text-lg text-brand-100 mb-6 leading-relaxed">
                There are over a dozen MRD tests on the market, and choosing the right one depends on your cancer type, where you are in treatment, and what your insurance covers.
              </p>
              <p className="text-brand-200 mb-8">
                We'll ask a few simple questions and match you with the tests that fit your medical and financial situation — with clear, vendor-neutral information from our nonprofit database.
              </p>
              <button
                onClick={() => onNavigate('patient-watching')}
                className="bg-white hover:bg-stone-100 text-brand-900 px-8 py-4 rounded-full font-medium transition-all flex items-center gap-2"
              >
                Find My Test <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </AnimateOnScroll>
        </div>
      </div>
    </section>
  );
}

/* ─── Section 4: Talk to Your Doctor — Teaser linking to FAQ page ─── */

const CONCERN_TEASERS = [
  '"There\'s no evidence MRD results change outcomes."',
  '"It\'s not in the guidelines yet."',
  '"What would I even do with a positive result?"',
  '"Insurance won\'t cover it."',
  '"The test isn\'t validated for your cancer type."',
];

function TalkToYourDoctor({ onNavigate }) {
  return (
    <section id="talk-to-doctor" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <AnimateOnScroll>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 text-violet-700 text-sm font-medium mb-6 border border-violet-200">
                <MessageCircle className="w-3.5 h-3.5" />
                Need to convince your doctor?
              </div>
              <h2 className="font-serif text-4xl md:text-5xl text-stone-900 mb-6">
                We'll help you make <span className="italic text-brand-700">the case for MRD.</span>
              </h2>
              <p className="text-lg text-stone-600 mb-8 leading-relaxed">
                Some doctors aren't yet familiar with MRD testing. We've prepared evidence-backed answers to the most common concerns — personalized to your cancer type and stage, with language your doctor will trust.
              </p>
              <button
                onClick={() => onNavigate('patient-doctor-faq')}
                className="bg-brand-700 hover:bg-brand-900 text-white px-8 py-4 rounded-full font-medium transition-all flex items-center gap-2"
              >
                Get Answers for Your Situation <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </AnimateOnScroll>

          <AnimateOnScroll animation="fade-in-up" delay={0.1}>
            <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
              <h3 className="font-serif text-xl text-stone-900 mb-6">Common doctor concerns we address:</h3>
              <ul className="space-y-4">
                {CONCERN_TEASERS.map((concern, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-serif font-bold text-xs mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-stone-700 font-medium">{concern}</p>
                  </li>
                ))}
              </ul>
            </div>
          </AnimateOnScroll>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ─── */
function PatientFooter({ onNavigate, scrollTo }) {
  return (
    <footer className="bg-stone-900 text-stone-400 py-12 border-t border-stone-800">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-8">
        <div className="col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="w-6 h-6 text-brand-500" />
            <span className="font-serif text-xl font-medium text-white">OpenOnco</span>
          </div>
          <p className="max-w-sm mb-6">
            A nonprofit making MRD monitoring accessible to every cancer patient through vendor-neutral information, cost transparency, and patient advocacy tools.
          </p>
        </div>
        <div>
          <h4 className="text-white font-medium mb-4">For Patients</h4>
          <ul className="space-y-2">
            <li><button onClick={() => onNavigate('patient-mrd-info')} className="hover:text-brand-400 transition-colors">What is MRD?</button></li>
            <li><button onClick={() => scrollTo('doctor-recommended')} className="hover:text-brand-400 transition-colors">Paying for a Test</button></li>
            <li><button onClick={() => scrollTo('find-test')} className="hover:text-brand-400 transition-colors">Find a Test</button></li>
            <li><button onClick={() => scrollTo('talk-to-doctor')} className="hover:text-brand-400 transition-colors">Talk to Your Doctor</button></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-medium mb-4">OpenOnco</h4>
          <ul className="space-y-2">
            <li><button onClick={() => onNavigate('about')} className="hover:text-brand-400 transition-colors">About Us</button></li>
            <li><button onClick={() => onNavigate('home')} className="hover:text-brand-400 transition-colors">Test Directory</button></li>
            <li><button onClick={() => onNavigate('patient-financial-assistance')} className="hover:text-brand-400 transition-colors">Financial Assistance</button></li>
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
