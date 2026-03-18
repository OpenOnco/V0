import React from 'react';
import { Heart, Activity, Shield, FileText, ArrowRight, Search, MessageCircle, Stethoscope } from 'lucide-react';
import AnimateOnScroll from '../components/patient/AnimateOnScroll';

export default function PatientLandingPage({ onNavigate }) {
  return (
    <div className="min-h-screen font-sans selection:bg-brand-100 selection:text-brand-900 bg-warm-50">
      <PatientNavigation />
      <main>
        <Hero onNavigate={onNavigate} />
        <DoctorRecommended onNavigate={onNavigate} />
        <FindTheRightTest onNavigate={onNavigate} />
        <TalkToYourDoctor onNavigate={onNavigate} />
      </main>
      <PatientFooter onNavigate={onNavigate} />
    </div>
  );
}

function PatientNavigation() {
  return (
    <nav className="sticky top-0 z-50 bg-warm-50/80 backdrop-blur-md border-b border-warm-200/50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-center gap-8">
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Heart className="w-6 h-6 text-brand-700" />
          <span className="font-serif text-xl font-medium text-brand-900">OpenOnco</span>
        </button>
        <div className="hidden md:flex items-center gap-6 text-base text-stone-500">
          <span>Nonprofit</span>
          <span className="text-stone-300">&middot;</span>
          <span>Independent</span>
          <span className="text-stone-300">&middot;</span>
          <span>160+ Tests</span>
          <span className="text-stone-300">&middot;</span>
          <span>75+ Vendors</span>
          <span className="text-stone-300">&middot;</span>
          <span>Updated Weekly</span>
        </div>
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
    <section className="relative pt-12 pb-8 md:pt-16 md:pb-12 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
        <div className="max-w-xl animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-sm font-medium mb-5 border border-brand-100">
            <Heart className="w-3.5 h-3.5" />
            A nonprofit making MRD accessible to all patients
          </div>
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl leading-[1.1] text-stone-900 mb-4">
            You finished treatment. <br />
            <span className="italic text-brand-700">Now there's a way to keep watch.</span>
          </h1>
          <p className="text-base text-stone-600 mb-3 leading-relaxed">
            <strong>MRD testing</strong> lets you and your care team monitor for recurrence with a simple blood test — so you can be proactive if it's ever needed.
          </p>
          <p className="text-sm text-stone-500 mb-6">
            OpenOnco is a nonprofit making MRD monitoring accessible to every cancer patient, regardless of insurance or income.
          </p>
          <button
            onClick={() => onNavigate('patient-mrd-info')}
            className="bg-brand-700 hover:bg-brand-900 text-white px-6 py-3 rounded-full text-sm font-medium transition-all flex items-center gap-2"
          >
            What is MRD Testing? <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="relative opacity-0 animate-fade-in-scale">
          <div className="absolute inset-0 bg-brand-100 rounded-[2.5rem] transform rotate-3 scale-105 -z-10"></div>
          <img
            src="https://images.unsplash.com/photo-1573497620053-ea5300f94f21?q=80&w=2000&auto=format&fit=crop"
            alt="Doctor and patient talking warmly"
            className="rounded-[2.5rem] shadow-2xl object-cover aspect-[4/3] w-full"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        </div>
      </div>

      {/* Three action cards — scroll to sections */}
      <div className="max-w-7xl mx-auto px-6 mt-10 md:mt-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { scrollTarget: 'doctor-recommended', icon: <Shield className="w-5 h-5 text-white" />, title: 'Coverage', subtitle: 'Is my test covered?', gradient: 'linear-gradient(135deg, rgba(30,75,184,0.80) 0%, rgba(15,45,107,0.85) 100%)', img: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=800&auto=format&fit=crop', ring: 'focus:ring-brand-500', subtitleColor: 'text-blue-100' },
            { scrollTarget: 'find-test', icon: <Search className="w-5 h-5 text-white" />, title: 'Test Search', subtitle: 'Which tests can help me?', gradient: 'linear-gradient(135deg, rgba(5,150,105,0.80) 0%, rgba(4,120,87,0.85) 100%)', img: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?q=80&w=800&auto=format&fit=crop', ring: 'focus:ring-emerald-500', subtitleColor: 'text-emerald-100' },
            { scrollTarget: 'talk-to-doctor', icon: <MessageCircle className="w-5 h-5 text-white" />, title: 'Doctor FAQs', subtitle: 'Help me make the case for MRD', gradient: 'linear-gradient(135deg, rgba(109,40,217,0.80) 0%, rgba(91,33,182,0.85) 100%)', img: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=800&auto=format&fit=crop', ring: 'focus:ring-violet-500', subtitleColor: 'text-violet-100' },
          ].map((card, i) => (
            <button
              key={i}
              onClick={() => scrollTo(card.scrollTarget)}
              className={`group relative rounded-2xl overflow-hidden h-48 md:h-56 text-left cursor-pointer w-full focus:outline-none focus:ring-2 ${card.ring} focus:ring-offset-2`}
            >
              <img
                src={card.img}
                alt=""
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
              <div
                className="absolute inset-0 transition-opacity duration-500"
                style={{ background: card.gradient }}
              />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-3">
                  {card.icon}
                </div>
                <h3 className="font-serif text-2xl text-white mb-1">{card.title}</h3>
                <p className={`${card.subtitleColor} text-sm`}>{card.subtitle}</p>
              </div>
            </button>
          ))}
        </div>
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
function PatientFooter({ onNavigate }) {
  return (
    <footer className="bg-stone-900 text-stone-400 py-12 border-t border-stone-800">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-8">
        <div className="col-span-2">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity">
            <Heart className="w-6 h-6 text-brand-500" />
            <span className="font-serif text-xl font-medium text-white">OpenOnco</span>
          </button>
          <p className="max-w-sm mb-6">
            A nonprofit making MRD monitoring accessible to every cancer patient through vendor-neutral information, cost transparency, and patient advocacy tools.
          </p>
        </div>
        <div>
          <h4 className="text-white font-medium mb-4">For Patients</h4>
          <ul className="space-y-2">
            <li><button onClick={() => onNavigate('patient-mrd-info')} className="hover:text-brand-400 transition-colors">What is MRD?</button></li>
            <li><button onClick={() => onNavigate('patient-lookup')} className="hover:text-brand-400 transition-colors">Coverage</button></li>
            <li><button onClick={() => onNavigate('patient-watching')} className="hover:text-brand-400 transition-colors">Test Search</button></li>
            <li><button onClick={() => onNavigate('patient-doctor-faq')} className="hover:text-brand-400 transition-colors">Doctor FAQs</button></li>
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
