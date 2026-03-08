import React from 'react';
import { Heart, Activity, Shield, ArrowLeft, ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import AnimateOnScroll from '../components/patient/AnimateOnScroll';

export default function PatientMRDInfoPage({ onNavigate }) {
  return (
    <div className="min-h-screen font-sans selection:bg-brand-100 selection:text-brand-900 bg-warm-50">
      {/* Simple nav */}
      <nav className="sticky top-0 z-50 bg-warm-50/80 backdrop-blur-md border-b border-warm-200/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => onNavigate('patient-landing')}
            className="flex items-center gap-2 text-stone-600 hover:text-brand-700 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <Heart className="w-6 h-6 text-brand-700" />
            <span className="font-serif text-xl font-medium text-brand-900">OpenOnco</span>
          </div>
          <button
            onClick={() => onNavigate('patient-watching')}
            className="bg-brand-700 hover:bg-brand-900 text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors"
          >
            Find a Test
          </button>
        </div>
      </nav>

      <main>
        {/* Hero */}
        <section className="pt-16 pb-12">
          <div className="max-w-3xl mx-auto px-6 text-center animate-fade-in-up">
            <h1 className="font-serif text-4xl md:text-5xl text-stone-900 mb-6">
              What is <span className="italic text-brand-700">MRD testing?</span>
            </h1>
            <p className="text-lg text-stone-600 leading-relaxed">
              MRD stands for <strong>Molecular Residual Disease</strong>. After you finish cancer treatment, tiny fragments of tumor DNA can still circulate in your blood — far too small to see on any scan. An MRD test detects these fragments with a simple blood draw, giving you and your doctor an early warning system.
            </p>
          </div>
        </section>

        {/* Negative vs Positive */}
        <section className="pb-24">
          <div className="max-w-5xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Negative result */}
              <AnimateOnScroll animation="fade-in-up" delay={0}>
                <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-8 h-full">
                  <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mb-6">
                    <TrendingDown className="w-6 h-6 text-emerald-700" />
                  </div>
                  <h2 className="font-serif text-2xl text-stone-900 mb-2">If your test is negative</h2>
                  <p className="text-sm font-medium text-emerald-700 mb-4">No tumor DNA detected</p>
                  <ul className="space-y-4 text-stone-600">
                    <li className="flex gap-3">
                      <Shield className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span><strong>Peace of mind.</strong> No detectable cancer DNA in your blood right now.</span>
                    </li>
                    <li className="flex gap-3">
                      <Activity className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span><strong>You may be able to reduce chemotherapy.</strong> In a landmark clinical trial, patients with negative MRD tests safely skipped adjuvant chemo with no worse outcomes — cutting chemo use nearly in half.</span>
                    </li>
                  </ul>
                  <div className="mt-6 pt-4 border-t border-emerald-200">
                    <p className="text-xs text-stone-500">
                      <strong>Source:</strong> The DYNAMIC trial (Tie et al., <em>New England Journal of Medicine</em>, 2022) showed ctDNA-guided treatment reduced chemotherapy use from 28% to 15% in stage II colon cancer with no difference in recurrence-free survival.
                      {' '}<a href="https://pubmed.ncbi.nlm.nih.gov/35657320/" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline hover:text-brand-800">PMID 35657320</a>
                    </p>
                  </div>
                </div>
              </AnimateOnScroll>

              {/* Positive result */}
              <AnimateOnScroll animation="fade-in-up" delay={0.15}>
                <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 h-full">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mb-6">
                    <TrendingUp className="w-6 h-6 text-amber-700" />
                  </div>
                  <h2 className="font-serif text-2xl text-stone-900 mb-2">If your test is positive</h2>
                  <p className="text-sm font-medium text-amber-700 mb-4">Tumor DNA detected</p>
                  <ul className="space-y-4 text-stone-600">
                    <li className="flex gap-3">
                      <Activity className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <span><strong>Months of lead time.</strong> MRD tests can detect recurrence an average of 8.7 months before it would appear on a CT scan — giving your care team time to act before the cancer advances.</span>
                    </li>
                    <li className="flex gap-3">
                      <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <span><strong>Earlier treatment, better options.</strong> Catching recurrence early means more treatment options and potentially better outcomes than waiting for symptoms or scan findings.</span>
                    </li>
                  </ul>
                  <div className="mt-6 pt-4 border-t border-amber-200">
                    <p className="text-xs text-stone-500">
                      <strong>Source:</strong> Reinert et al. (<em>JAMA Oncology</em>, 2019) found ctDNA detected recurrence a median 8.7 months before imaging in stage I–III colorectal cancer (range: 0.8–16.5 months).
                      {' '}<a href="https://pubmed.ncbi.nlm.nih.gov/31070691/" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline hover:text-brand-800">PMID 31070691</a>
                    </p>
                  </div>
                </div>
              </AnimateOnScroll>
            </div>

            {/* How it works callout */}
            <AnimateOnScroll>
              <div className="mt-12 max-w-3xl mx-auto">
                <div className="bg-white border border-warm-200 rounded-2xl p-6 text-center">
                  <p className="text-stone-600">
                    <strong>How does it work?</strong> It's a simple blood draw — no surgery, no biopsy. Your blood sample is analyzed for circulating tumor DNA (ctDNA) shed by cancer cells. Your doctor orders the test and results typically come back within two weeks.
                  </p>
                </div>
              </div>
            </AnimateOnScroll>

            {/* CTA */}
            <div className="mt-16 text-center">
              <p className="text-lg text-stone-600 mb-6">Ready to explore your options?</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => onNavigate('patient-watching')}
                  className="bg-brand-700 hover:bg-brand-900 text-white px-8 py-4 rounded-full font-medium transition-all flex items-center gap-2"
                >
                  Find the Right Test <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onNavigate('patient-landing')}
                  className="bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 px-8 py-4 rounded-full font-medium transition-all"
                >
                  Back to Patient Home
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Minimal footer */}
      <footer className="bg-stone-900 text-stone-400 py-8 border-t border-stone-800">
        <div className="max-w-7xl mx-auto px-6 text-sm flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-2 md:mb-0">
            <Heart className="w-4 h-4 text-brand-500" />
            <span className="text-white font-medium">OpenOnco</span>
          </div>
          <p>This information is for educational purposes and does not replace professional medical advice.</p>
        </div>
      </footer>
    </div>
  );
}
