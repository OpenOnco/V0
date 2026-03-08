import { motion } from 'motion/react';
import { Heart, Activity, Shield, FileText, ArrowRight } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen font-sans selection:bg-brand-100 selection:text-brand-900">
      <Navigation />
      <main>
        <Hero />
        <Introduction />
        <TestTypes />
        <DoctorQuestions />
        <SupportSection />
      </main>
      <Footer />
    </div>
  );
}

function Navigation() {
  return (
    <nav className="sticky top-0 z-50 bg-warm-50/80 backdrop-blur-md border-b border-warm-200/50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-6 h-6 text-brand-700" />
          <span className="font-serif text-xl font-medium text-brand-900">OpenOnco Patient Guide</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600">
          <a href="#understanding" className="hover:text-brand-700 transition-colors">Understanding Tests</a>
          <a href="#types" className="hover:text-brand-700 transition-colors">Types of Diagnostics</a>
          <a href="#questions" className="hover:text-brand-700 transition-colors">Questions to Ask</a>
        </div>
        <button className="bg-brand-700 hover:bg-brand-900 text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors">
          Find a Test
        </button>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative pt-20 pb-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-xl"
        >
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
            <a href="#understanding" className="bg-brand-700 hover:bg-brand-900 text-white px-8 py-4 rounded-full font-medium transition-all flex items-center gap-2">
              Start Learning <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          className="relative"
        >
          <div className="absolute inset-0 bg-brand-100 rounded-[3rem] transform rotate-3 scale-105 -z-10"></div>
          <img 
            src="https://images.unsplash.com/photo-1573497620053-ea5300f94f21?q=80&w=2000&auto=format&fit=crop" 
            alt="Doctor and patient talking warmly" 
            className="rounded-[3rem] shadow-2xl object-cover aspect-[4/3] w-full"
            referrerPolicy="no-referrer"
          />
          
          {/* Floating badge */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="absolute -bottom-6 -left-6 bg-white p-6 rounded-3xl shadow-xl max-w-xs border border-stone-100"
          >
            <div className="flex items-center gap-4 mb-2">
              <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center">
                <Shield className="w-5 h-5 text-brand-700" />
              </div>
              <p className="font-serif text-lg font-medium text-stone-900">Knowledge is power</p>
            </div>
            <p className="text-sm text-stone-500">Understanding your tumor's unique profile leads to better-targeted treatments.</p>
          </motion.div>
        </motion.div>
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
              />
              <img 
                src="https://images.unsplash.com/photo-1579684385127-1ef15d508118?q=80&w=1000&auto=format&fit=crop" 
                alt="Medical professional reviewing results" 
                className="rounded-b-full rounded-t-[3rem] object-cover aspect-[2/3] w-full shadow-lg mt-12"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          
          <div className="order-1 md:order-2">
            <h2 className="font-serif text-4xl md:text-5xl text-stone-900 mb-6">
              What are <span className="italic text-brand-700">molecular diagnostics?</span>
            </h2>
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
          <h2 className="font-serif text-4xl md:text-5xl mb-6">Types of Diagnostics</h2>
          <p className="text-brand-100 text-lg">
            There are several different types of molecular tests. Your doctor will recommend the right one based on where you are in your treatment journey.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          {tests.map((test, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-brand-800/50 border border-brand-700/50 p-8 rounded-3xl hover:bg-brand-800 transition-colors"
            >
              <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mb-6">
                {test.icon}
              </div>
              <h3 className="font-serif text-2xl mb-3">{test.title}</h3>
              <p className="text-brand-100 leading-relaxed">
                {test.description}
              </p>
            </motion.div>
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
          <div className="lg:col-span-5 sticky top-32">
            <h2 className="font-serif text-4xl md:text-5xl text-stone-900 mb-6">
              Questions to ask <span className="italic text-brand-700">your doctor.</span>
            </h2>
            <p className="text-lg text-stone-600 mb-8">
              You are your own best advocate. Print or save these questions to bring to your next oncology appointment. It's okay to ask for clarification if you don't understand the medical jargon.
            </p>
            <button className="bg-white border border-stone-200 hover:border-brand-300 text-stone-800 px-6 py-3 rounded-full font-medium transition-all shadow-sm flex items-center gap-2">
              <FileText className="w-4 h-4" /> Print Questions
            </button>
          </div>
          
          <div className="lg:col-span-7 space-y-4">
            {questions.map((q, i) => (
              <QuestionCard key={i} question={q} index={i + 1} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function QuestionCard({ question, index }: { question: string, index: number, key?: number | string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex gap-4 items-start"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-serif font-bold text-lg">
        {index}
      </div>
      <p className="text-stone-800 text-lg pt-1 font-medium">{question}</p>
    </motion.div>
  );
}

function SupportSection() {
  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-50 rounded-full blur-3xl -z-10 opacity-60 translate-x-1/3 -translate-y-1/3"></div>
        
        <div className="bg-brand-50 rounded-[3rem] p-8 md:p-16 text-center max-w-5xl mx-auto relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="font-serif text-4xl md:text-5xl text-stone-900 mb-6">
              You are not alone in this.
            </h2>
            <p className="text-lg text-stone-600 max-w-2xl mx-auto mb-10">
              Navigating a cancer diagnosis is challenging, but understanding your tumor's biology is a powerful step forward. We are here to provide clarity and support.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button className="bg-brand-700 hover:bg-brand-900 text-white px-8 py-4 rounded-full font-medium transition-all w-full sm:w-auto">
                Explore Test Directory
              </button>
              <button className="bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 px-8 py-4 rounded-full font-medium transition-all w-full sm:w-auto">
                Read Patient Stories
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
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
            <li><a href="#" className="hover:text-brand-400 transition-colors">Understanding Tests</a></li>
            <li><a href="#" className="hover:text-brand-400 transition-colors">Questions for your Doctor</a></li>
            <li><a href="#" className="hover:text-brand-400 transition-colors">Financial Assistance</a></li>
            <li><a href="#" className="hover:text-brand-400 transition-colors">Glossary of Terms</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-medium mb-4">OpenOnco</h4>
          <ul className="space-y-2">
            <li><a href="#" className="hover:text-brand-400 transition-colors">About Us</a></li>
            <li><a href="#" className="hover:text-brand-400 transition-colors">Test Directory</a></li>
            <li><a href="#" className="hover:text-brand-400 transition-colors">For Providers</a></li>
            <li><a href="#" className="hover:text-brand-400 transition-colors">Contact</a></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-stone-800 text-sm flex flex-col md:flex-row items-center justify-between">
        <p>© {new Date().getFullYear()} OpenOnco. All rights reserved.</p>
        <p className="mt-2 md:mt-0">This information is for educational purposes and does not replace professional medical advice.</p>
      </div>
    </footer>
  );
}
