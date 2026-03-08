import React, { useState, useEffect } from 'react';
import { Heart, ArrowLeft, ChevronDown, FileText, Printer, ArrowRight, MessageCircle } from 'lucide-react';
import { CONCERNS, getAnswer, getStageNote } from '../config/physicianFAQ';

const CANCER_TYPES = [
  { id: 'colorectal', label: 'Colorectal' },
  { id: 'breast', label: 'Breast' },
  { id: 'lung', label: 'Lung' },
  { id: 'bladder', label: 'Bladder' },
  { id: 'melanoma', label: 'Melanoma' },
  { id: 'ovarian', label: 'Ovarian' },
  { id: 'prostate', label: 'Prostate' },
  { id: 'pancreatic', label: 'Pancreatic' },
  { id: 'other-solid', label: 'Other' },
];

const CANCER_STAGES = [
  { id: 'stage-1', label: 'Stage I' },
  { id: 'stage-2', label: 'Stage II' },
  { id: 'stage-3', label: 'Stage III' },
  { id: 'stage-4', label: 'Stage IV' },
  { id: 'not-sure', label: 'Not sure' },
];

export default function PatientDoctorFAQPage({ onNavigate }) {
  const [cancerType, setCancerType] = useState(null);
  const [stage, setStage] = useState(null);
  const [openIndex, setOpenIndex] = useState(null);

  // Pre-fill from sessionStorage if patient already provided context
  useEffect(() => {
    try {
      const ctx = JSON.parse(sessionStorage.getItem('openonco-patient-context') || '{}');
      if (ctx.cancerType) setCancerType(ctx.cancerType);
      if (ctx.stage) setStage(ctx.stage);
    } catch {}
  }, []);

  const hasContext = cancerType && stage;

  const handlePrint = (index) => {
    setOpenIndex(index);
    setTimeout(() => window.print(), 100);
  };

  return (
    <div className="min-h-screen font-sans bg-warm-50 flex flex-col">
      {/* Nav */}
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
          <div className="w-[72px]" />
        </div>
      </nav>

      <main className="flex-1">
        {/* Header */}
        <section className="py-16 bg-white border-b border-stone-200">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 text-violet-700 text-sm font-medium mb-6 border border-violet-200">
              <MessageCircle className="w-3.5 h-3.5" />
              Physician FAQ
            </div>
            <h1 className="font-serif text-4xl md:text-5xl text-stone-900 mb-4">
              Help your doctor understand <span className="italic text-brand-700">MRD testing.</span>
            </h1>
            <p className="text-lg text-stone-600 max-w-2xl mx-auto">
              These are the most common concerns doctors raise — with evidence-backed answers personalized to your cancer type and stage.
            </p>
          </div>
        </section>

        {/* Intake — only show if context not already provided */}
        {!hasContext && (
          <section className="py-12 bg-warm-50 border-b border-stone-200">
            <div className="max-w-4xl mx-auto px-6">
              <div className="text-center mb-8">
                <h2 className="font-serif text-2xl text-stone-900 mb-2">Tell us your situation</h2>
                <p className="text-stone-500">We'll personalize the answers for you.</p>
              </div>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-3">Cancer type</label>
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
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-3">Stage</label>
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
            </div>
          </section>
        )}

        {/* Context summary bar when filled */}
        {hasContext && (
          <div className="bg-brand-50 border-b border-brand-100 py-3">
            <div className="max-w-4xl mx-auto px-6 flex items-center justify-between">
              <p className="text-sm text-brand-800 font-medium">
                Personalized for: {CANCER_TYPES.find(t => t.id === cancerType)?.label || cancerType} cancer, {CANCER_STAGES.find(s => s.id === stage)?.label || stage}
              </p>
              <button
                onClick={() => { setCancerType(null); setStage(null); }}
                className="text-sm text-brand-600 hover:text-brand-800 underline"
              >
                Change
              </button>
            </div>
          </div>
        )}

        {/* FAQ accordion */}
        <section className="py-16">
          <div className="max-w-4xl mx-auto px-6 space-y-4">
            {CONCERNS.map((concern, i) => {
              if (concern.isWizardLink) {
                return (
                  <InsuranceConcernCard
                    key={concern.id}
                    concern={concern}
                    index={i}
                    onNavigate={onNavigate}
                  />
                );
              }

              const answer = getAnswer(cancerType, concern.id);
              const stageNote = getStageNote(cancerType, concern.id, stage);

              return (
                <FAQAccordionItem
                  key={concern.id}
                  concern={concern}
                  answer={answer}
                  stageNote={stageNote}
                  index={i}
                  isOpen={openIndex === i}
                  onToggle={() => setOpenIndex(openIndex === i ? null : i)}
                  onPrint={() => handlePrint(i)}
                  isPersonalized={!!cancerType}
                />
              );
            })}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="py-16 bg-brand-900 text-white">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="font-serif text-3xl mb-4">Ready to find the right test?</h2>
            <p className="text-brand-200 mb-8 max-w-xl mx-auto">
              Now that you have the evidence, let us help you find the MRD test that fits your cancer type, insurance, and budget.
            </p>
            <button
              onClick={() => {
                if (cancerType || stage) {
                  sessionStorage.setItem('openonco-patient-context', JSON.stringify({ cancerType, stage }));
                }
                onNavigate('patient-watching');
              }}
              className="bg-white hover:bg-stone-100 text-brand-900 px-8 py-4 rounded-full font-medium transition-all inline-flex items-center gap-2"
            >
              Find My Test <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
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

/* ─── Individual FAQ accordion item ─── */
function FAQAccordionItem({ concern, answer, stageNote, index, isOpen, onToggle, onPrint, isPersonalized }) {
  if (!answer) return null;

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden transition-all duration-200 ${isOpen ? 'border-violet-300 shadow-md' : 'border-stone-200 hover:border-violet-200'}`}>
      <button
        onClick={onToggle}
        className="w-full text-left p-6 flex items-start gap-4"
      >
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-serif font-bold text-sm mt-0.5">
          {index + 1}
        </div>
        <div className="flex-1">
          <p className="text-stone-900 text-lg font-medium pr-8">{concern.label}</p>
          {!isOpen && <p className="text-stone-500 text-sm mt-1">{answer.forPatient.slice(0, 120)}...</p>}
        </div>
        <ChevronDown className={`w-5 h-5 text-stone-400 flex-shrink-0 mt-1 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="px-6 pb-6 pt-0">
          {/* Patient-friendly answer */}
          <div className="ml-12 mb-6">
            <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 mb-4">
              <p className="text-sm font-medium text-brand-800 mb-1">In plain language:</p>
              <p className="text-stone-700">{answer.forPatient}</p>
            </div>

            {/* Stage-specific note */}
            {stageNote && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <p className="text-sm font-medium text-amber-800 mb-1">For your stage specifically:</p>
                <p className="text-sm text-stone-700">{stageNote}</p>
              </div>
            )}
          </div>

          {/* Doctor-facing evidence */}
          <div className="ml-12">
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-medium text-stone-800 mb-2">For your doctor — clinical evidence:</p>
              <p className="text-sm text-stone-600 leading-relaxed">{answer.forDoctor}</p>
            </div>

            {/* Guidelines */}
            {answer.guidelines && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-emerald-800">
                  <strong>Guideline status:</strong> {answer.guidelines}
                </p>
              </div>
            )}

            {/* Sources */}
            {answer.sources && answer.sources.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {answer.sources.map((src, j) => (
                  <a
                    key={j}
                    href={src.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${src.pmid}/` : src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs bg-white border border-stone-200 rounded-full px-3 py-1 text-brand-600 hover:text-brand-800 hover:border-brand-300 transition-colors"
                  >
                    <FileText className="w-3 h-3" />
                    {src.label}
                  </a>
                ))}
              </div>
            )}

            {/* Personalization note */}
            {isPersonalized && (
              <p className="text-xs text-stone-400 mb-3">
                This answer is tailored to your cancer type. Sources reflect the most relevant clinical evidence.
              </p>
            )}

            {/* Print button */}
            <button
              onClick={(e) => { e.stopPropagation(); onPrint(); }}
              className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-brand-700 transition-colors"
            >
              <Printer className="w-4 h-4" /> Print this for your doctor
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Insurance concern — links to TestLookupWizard instead of showing an answer ─── */
function InsuranceConcernCard({ concern, index, onNavigate }) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6 hover:border-violet-200 transition-all">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-serif font-bold text-sm mt-0.5">
          {index + 1}
        </div>
        <div className="flex-1">
          <p className="text-stone-900 text-lg font-medium mb-2">{concern.label}</p>
          <p className="text-stone-600 mb-4">
            Coverage is expanding rapidly. Medicare now covers several MRD tests, and many private insurers are following. We can check your specific situation and find financial assistance programs.
          </p>
          <button
            onClick={() => onNavigate('patient-lookup')}
            className="inline-flex items-center gap-2 bg-brand-700 hover:bg-brand-900 text-white px-6 py-3 rounded-full text-sm font-medium transition-colors"
          >
            Check Your Coverage <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
