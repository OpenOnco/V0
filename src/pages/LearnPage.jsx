import { useState, useEffect } from 'react';
import { mrdTestData, ecdTestData, trmTestData, tdsTestData } from '../data';
import { getStoredPersona } from '../utils/persona';
import GlossaryTooltip from '../components/GlossaryTooltip';

const LearnPage = ({ onNavigate }) => {
  const [persona, setPersona] = useState(getStoredPersona() || 'rnd');
  
  // Listen for persona changes
  useEffect(() => {
    const handlePersonaChange = (e) => setPersona(e.detail);
    window.addEventListener('personaChanged', handlePersonaChange);
    return () => window.removeEventListener('personaChanged', handlePersonaChange);
  }, []);

  const isPatient = persona === 'patient';

  // Patient-friendly category content
  const patientCategories = [
    {
      id: 'TDS',
      phase: 'Diagnosis',
      name: 'Tests that help choose my treatment',
      acronym: 'TDS',
      color: 'violet',
      icon: '🧬',
      clinicalQuestion: 'Which treatment will work best for my cancer?',
      description: 'These tests analyze your tumor to find specific characteristics that can help your doctor choose the most effective treatment. Some cancers have genetic changes that make them respond well to certain targeted therapies. Finding these changes can open up more treatment options.',
      keyPoints: [
        'Identifies genetic changes in your tumor',
        'May qualify you for targeted therapies',
        'Some tests are required before certain treatments can be prescribed',
        'Results help your oncologist create a personalized treatment plan'
      ],
      testCount: tdsTestData.length
    },
    {
      id: 'TRM',
      phase: 'Treatment',
      name: 'Tests that track my response to treatment',
      acronym: 'TRM',
      color: 'sky',
      icon: '📊',
      clinicalQuestion: 'Is my treatment working?',
      description: 'Monitoring tests measure tumor DNA in your blood over time to see if your treatment is working. Decreasing levels usually mean the treatment is effective. Rising levels might mean the cancer is becoming resistant, often detectable weeks before changes show up on scans.',
      keyPoints: [
        'Tracks response through simple blood draws',
        'Can detect changes earlier than imaging scans',
        'Helps your doctor adjust treatment if needed',
        'Less invasive than repeated biopsies'
      ],
      testCount: trmTestData.length
    },
    {
      id: 'MRD',
      phase: 'Surveillance',
      name: 'Tests that watch over me after treatment',
      acronym: 'MRD',
      color: 'orange',
      icon: '🔍',
      clinicalQuestion: 'Has my cancer come back?',
      description: 'After you finish treatment, these tests look for tiny amounts of cancer DNA that might remain in your blood. Finding this "minimal residual disease" early can help your doctor act quickly if the cancer starts to return. Regular testing provides peace of mind and early warning.',
      keyPoints: [
        'Detects microscopic cancer before it becomes visible',
        'Provides early warning of potential recurrence',
        'Helps determine if additional treatment is needed',
        'Regular monitoring during surveillance period'
      ],
      testCount: mrdTestData.length
    }
  ];

  const categories = isPatient ? patientCategories : [
    {
      id: 'ECD',
      phase: 'Screening',
      name: 'Early Cancer Detection',
      acronym: 'ECD',
      color: 'emerald',
      icon: '🔬',
      clinicalQuestion: 'Can cancer be detected before clinical presentation?',
      description: 'Early cancer detection (ECD) tests screen asymptomatic individuals for cancer signals in blood or stool. These assays analyze tumor-derived molecules including ctDNA methylation patterns, fragmentomic features (cfDNA fragment size distributions and end motifs), and protein biomarkers. Single-cancer tests focus on one cancer type (e.g., colorectal), while multi-cancer early detection (MCED) tests screen for signals across 50+ cancer types.',
      technology: 'Most ECD tests rely on methylation profiling, as cancer-specific methylation patterns are more abundant and consistent than somatic mutations in early-stage disease. Machine learning classifiers trained on methylation arrays can detect cancer signals and predict tissue of origin. Some platforms combine methylation with fragmentomics or proteomics for improved sensitivity.',
      keyMetrics: [
        'Sensitivity by cancer type and stage (typically 20-40% for stage I, 70-90% for stage IV)',
        'Specificity (target >99% to minimize false positives in screening populations)',
        'Positive predictive value (PPV) depends heavily on cancer prevalence',
        'Cancer signal origin (CSO) accuracy for localization'
      ],
      challenges: [
        'Low ctDNA fraction in early-stage disease (<0.1% VAF)',
        'Clonal hematopoiesis of indeterminate potential (CHIP) confounds mutation-based approaches',
        'Requires large validation cohorts across diverse cancer types',
        'Clinical utility studies (mortality reduction) still in progress'
      ],
      testCount: ecdTestData.length
    },
    {
      id: 'TDS',
      phase: 'Diagnosis',
      name: 'Treatment Decision Support',
      acronym: 'TDS',
      color: 'violet',
      icon: '🧬',
      clinicalQuestion: 'What is the best treatment approach for this patient?',
      description: 'TDS tests help guide treatment decisions by providing molecular or biomarker information. This includes genomic profiling tests that identify actionable mutations for targeted therapy selection, as well as risk stratification tests that help determine whether interventions like biopsies are needed.',
      technology: 'Includes multiple technologies: NGS-based comprehensive genomic profiling (CGP) from tumor tissue or liquid biopsy to identify targetable alterations; protein structure analysis for risk stratification; and other biomarker assays. Some tests are FDA-approved as companion diagnostics.',
      keyMetrics: [
        'Sensitivity and specificity for intended use case',
        'FDA approval status and guideline recommendations',
        'Turnaround time',
        'Coverage by Medicare and commercial payers'
      ],
      challenges: [
        'Matching test results to appropriate clinical decisions',
        'Variants of uncertain significance (VUS) interpretation in genomic tests',
        'Balancing sensitivity vs specificity for risk stratification',
        'Integration into clinical workflow'
      ],
      testCount: tdsTestData.length
    },
    {
      id: 'TRM',
      phase: 'Treatment',
      name: 'Treatment Response Monitoring',
      acronym: 'TRM',
      color: 'sky',
      icon: '📊',
      clinicalQuestion: 'Is the current therapy effective, and is resistance emerging?',
      description: 'TRM uses serial liquid biopsies to quantify ctDNA dynamics during active therapy. Decreasing ctDNA levels correlate with treatment response; rising levels may indicate progression or resistance—often weeks before radiographic changes are detectable.',
      technology: 'TRM approaches vary: some track specific mutations identified at baseline (tumor-informed), while others monitor a fixed panel of common cancer mutations (tumor-naïve). Quantification methods include variant allele frequency (VAF), absolute ctDNA concentration (copies/mL), or composite molecular response scores. Some platforms can detect emerging resistance mutations to guide therapy switching.',
      keyMetrics: [
        'Analytical sensitivity for quantification at low VAF',
        'Coefficient of variation (CV) for serial measurements',
        'Molecular response thresholds (fold-change or absolute cutoffs)',
        'Correlation with clinical outcomes (PFS, OS)'
      ],
      challenges: [
        'Standardization of "molecular response" definitions across platforms',
        'Optimal sampling intervals during therapy',
        'Integration with imaging-based response assessment',
        'Cost of serial testing'
      ],
      testCount: trmTestData.length
    },
    {
      id: 'MRD',
      phase: 'Surveillance',
      name: 'Minimal Residual Disease',
      acronym: 'MRD',
      color: 'orange',
      icon: '🎯',
      clinicalQuestion: 'Does molecular evidence of disease persist after curative-intent treatment?',
      description: 'MRD testing detects residual cancer at levels far below imaging resolution (typically 0.01-0.001% VAF). MRD-positive status after surgery correlates with higher recurrence risk; MRD-negative results support molecular complete response. Serial MRD testing during surveillance can detect recurrence months before clinical presentation.',
      technology: 'Tumor-informed MRD assays sequence the primary tumor to identify patient-specific mutations, then design custom PCR or hybrid capture panels to track those variants in plasma with maximum sensitivity. Tumor-naïve approaches use fixed panels or methylation signatures. Tumor-informed methods achieve lower LOD but require tissue and longer setup time.',
      keyMetrics: [
        'Limit of detection (LOD)—tumor-informed typically 0.001-0.01% VAF',
        'Sensitivity (% of relapsing patients detected MRD+)',
        'Specificity (% of non-relapsing patients correctly MRD-)',
        'Lead time before clinical/radiographic recurrence'
      ],
      challenges: [
        'Requires adequate tumor tissue for tumor-informed approaches',
        'Turnaround time for custom assay design (2-4 weeks)',
        'Optimal surveillance testing intervals not established for all cancers',
        'Clinical utility data (does MRD-guided therapy improve outcomes?) still maturing'
      ],
      testCount: mrdTestData.length
    }
  ];

  const colorClasses = {
    emerald: {
      bg: 'bg-emerald-50',
      bgMedium: 'bg-emerald-100',
      border: 'border-emerald-200',
      borderActive: 'border-emerald-500',
      text: 'text-emerald-600',
      textDark: 'text-emerald-700',
      button: 'bg-emerald-500 hover:bg-emerald-600',
      iconBg: 'bg-emerald-100',
    },
    violet: {
      bg: 'bg-violet-50',
      bgMedium: 'bg-violet-100',
      border: 'border-violet-200',
      borderActive: 'border-violet-500',
      text: 'text-violet-600',
      textDark: 'text-violet-700',
      button: 'bg-violet-500 hover:bg-violet-600',
      iconBg: 'bg-violet-100',
    },
    sky: {
      bg: 'bg-sky-50',
      bgMedium: 'bg-sky-100',
      border: 'border-sky-200',
      borderActive: 'border-sky-500',
      text: 'text-sky-600',
      textDark: 'text-sky-700',
      button: 'bg-sky-500 hover:bg-sky-600',
      iconBg: 'bg-sky-100',
    },
    orange: {
      bg: 'bg-orange-50',
      bgMedium: 'bg-orange-100',
      border: 'border-orange-200',
      borderActive: 'border-orange-500',
      text: 'text-orange-600',
      textDark: 'text-orange-700',
      button: 'bg-orange-500 hover:bg-orange-600',
      iconBg: 'bg-orange-100',
    },
    indigo: {
      bg: 'bg-indigo-50',
      bgMedium: 'bg-indigo-100',
      border: 'border-indigo-200',
      borderActive: 'border-indigo-500',
      text: 'text-indigo-600',
      textDark: 'text-indigo-700',
      button: 'bg-indigo-500 hover:bg-indigo-600',
      iconBg: 'bg-indigo-100',
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
          {isPatient ? 'Understanding Cancer Blood Tests' : 'Advanced Molecular Diagnostics: An Overview'}
        </h1>
        <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
          {isPatient 
            ? 'New blood tests can help detect cancer early, find the best treatments, track how well therapy is working, and watch for cancer returning. Learn about the different types and how they might help you.'
            : 'Modern diagnostic technologies—from next-generation sequencing to protein biomarker analysis—enable blood-based tests across the full cancer care continuum, from early detection to post-treatment surveillance.'}
        </p>
      </div>

      {/* The Technology Section - Hide for patients */}
      {!isPatient && (
      <div className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-2xl p-6 sm:p-8 mb-12 border border-slate-200">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">The Underlying Technologies</h2>
        <p className="text-gray-700 mb-4">
          Advanced molecular diagnostics leverage multiple technologies to extract clinically actionable information from patient samples. <GlossaryTooltip termKey="cfdna"><strong>Cell-free DNA (cfDNA)</strong></GlossaryTooltip> analysis isolates DNA fragments released by cells into the bloodstream—in cancer patients, a fraction derives from tumor cells (<GlossaryTooltip termKey="ctdna"><strong>circulating tumor DNA or ctDNA</strong></GlossaryTooltip>), carrying the same somatic alterations present in the tumor. Beyond DNA, tests may analyze <GlossaryTooltip termKey="methylation">methylation patterns</GlossaryTooltip>, protein biomarkers, or structural variants.
        </p>
        <p className="text-gray-700 mb-6">
          These technologies answer different clinical questions depending on the patient's disease state:
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
            <span className="text-2xl">🔬</span>
            <div>
              <p className="font-semibold text-gray-900">Early Detection</p>
              <p className="text-sm text-gray-600">Detect cancer signals in asymptomatic individuals</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
            <span className="text-2xl">🧬</span>
            <div>
              <p className="font-semibold text-gray-900">Treatment Decisions</p>
              <p className="text-sm text-gray-600">Guide therapy selection and intervention decisions</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
            <span className="text-2xl">📊</span>
            <div>
              <p className="font-semibold text-gray-900">Response Monitoring</p>
              <p className="text-sm text-gray-600">Track <GlossaryTooltip termKey="ctdna">ctDNA</GlossaryTooltip> dynamics during active treatment</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
            <span className="text-2xl">🎯</span>
            <div>
              <p className="font-semibold text-gray-900"><GlossaryTooltip termKey="mrd">MRD</GlossaryTooltip> Detection</p>
              <p className="text-sm text-gray-600">Identify residual disease after curative treatment</p>
            </div>
          </div>
        </div>
        
        {/* ctDNA Signal Challenge */}
        <div className="mt-6 p-4 bg-white rounded-xl border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3">The <GlossaryTooltip termKey="ctdna">ctDNA</GlossaryTooltip> Signal Challenge</h3>
          <p className="text-sm text-gray-700 mb-3">
            The fraction of <GlossaryTooltip termKey="cfdna">cfDNA</GlossaryTooltip> that derives from tumor (<GlossaryTooltip termKey="ctdna">ctDNA</GlossaryTooltip> fraction) varies dramatically by clinical context, which drives the <GlossaryTooltip termKey="sensitivity">sensitivity</GlossaryTooltip> requirements for each test category:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Clinical Context</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Typical ctDNA Fraction</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Required <GlossaryTooltip termKey="lod">LOD</GlossaryTooltip></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-2 px-3 text-gray-700">Advanced cancer (TDS)</td>
                  <td className="py-2 px-3 text-gray-600">1–10%+</td>
                  <td className="py-2 px-3 text-gray-600">0.5–5% <GlossaryTooltip termKey="vaf">VAF</GlossaryTooltip></td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-gray-700">Early-stage screening (ECD)</td>
                  <td className="py-2 px-3 text-gray-600">0.01–0.1%</td>
                  <td className="py-2 px-3 text-gray-600">&lt;0.1% VAF</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-gray-700">Post-surgery surveillance (<GlossaryTooltip termKey="mrd">MRD</GlossaryTooltip>)</td>
                  <td className="py-2 px-3 text-gray-600">0.001–0.01%</td>
                  <td className="py-2 px-3 text-gray-600">&lt;0.01% VAF</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-gray-700">Treatment monitoring (TRM)</td>
                  <td className="py-2 px-3 text-gray-600">Variable (dynamic)</td>
                  <td className="py-2 px-3 text-gray-600">Quantitative accuracy</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {/* Detailed Category Sections */}
      <div className="space-y-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-8">
          {isPatient ? 'Types of Cancer Blood Tests' : 'Test Categories: Technical Deep Dive'}
        </h2>
        
        {categories.map((cat) => {
          const colors = colorClasses[cat.color];
          return (
            <div key={cat.id} className={`${colors.bg} ${colors.border} border-2 rounded-2xl overflow-hidden`}>
              {/* Category Header */}
              <div className={`${colors.bgMedium} px-6 py-4 border-b ${colors.border}`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{cat.icon}</span>
                  <div>
                    <p className={`text-xs font-semibold ${colors.text} uppercase tracking-wide`}>{cat.phase}</p>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900">{cat.name} ({cat.acronym})</h3>
                  </div>
                </div>
              </div>
              
              {/* Category Content */}
              <div className="p-6 space-y-6">
                {/* Clinical Question */}
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Clinical Question</p>
                  <p className="text-lg font-medium text-gray-900 italic">"{cat.clinicalQuestion}"</p>
                </div>

                {/* Description */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Overview</h4>
                  <p className="text-gray-700">{cat.description}</p>
                </div>

                {/* Patient: Key Points | R&D: Technology & Metrics */}
                {isPatient ? (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">What to Know</h4>
                    <ul className="space-y-2">
                      {cat.keyPoints?.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-gray-700">
                          <span className={`${colors.text} mt-1`}>✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <>
                    {/* Technology */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Technology & Methodology</h4>
                      <p className="text-gray-700">{cat.technology}</p>
                    </div>

                    {/* Two columns for metrics and challenges */}
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Key Performance Metrics</h4>
                        <ul className="space-y-2">
                          {cat.keyMetrics?.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-gray-700 text-sm">
                              <span className={`${colors.text} mt-1`}>•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Technical Challenges</h4>
                        <ul className="space-y-2">
                          {cat.challenges?.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-gray-700 text-sm">
                              <span className={`${colors.text} mt-1`}>•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </>
                )}

                {/* CTA */}
                <div className="pt-2">
                  <button
                    onClick={() => onNavigate(cat.id)}
                    className={`${colors.button} text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2`}
                  >
                    Explore {cat.testCount} {cat.acronym} Tests
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Reference Table */}
      <div className="mt-12 bg-white rounded-2xl border-2 border-gray-200 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">Quick Reference: Test Category Selection</h2>
        <p className="text-gray-600 text-center mb-6">Match clinical context to the appropriate test category:</p>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Clinical Context</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Test Category</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Primary Output</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => onNavigate('ECD')}>
                <td className="py-3 px-4 text-gray-700">Asymptomatic screening</td>
                <td className="py-3 px-4"><span className="text-emerald-600 font-medium">ECD →</span></td>
                <td className="py-3 px-4 text-gray-600 text-sm">Cancer signal detected (Y/N), tissue of origin</td>
              </tr>
              <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => onNavigate('TDS')}>
                <td className="py-3 px-4 text-gray-700">Newly diagnosed / therapy selection</td>
                <td className="py-3 px-4"><span className="text-violet-600 font-medium">TDS →</span></td>
                <td className="py-3 px-4 text-gray-600 text-sm">Actionable mutations, MSI, TMB, fusions</td>
              </tr>
              <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => onNavigate('TRM')}>
                <td className="py-3 px-4 text-gray-700">On active systemic therapy</td>
                <td className="py-3 px-4"><span className="text-sky-600 font-medium">TRM →</span></td>
                <td className="py-3 px-4 text-gray-600 text-sm">ctDNA quantification, molecular response</td>
              </tr>
              <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => onNavigate('MRD')}>
                <td className="py-3 px-4 text-gray-700">Post-curative treatment surveillance</td>
                <td className="py-3 px-4"><span className="text-orange-600 font-medium">MRD →</span></td>
                <td className="py-3 px-4 text-gray-600 text-sm">MRD status (positive/negative), recurrence risk</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Key Terms Glossary */}
      <div className="mt-12 bg-white rounded-2xl border-2 border-gray-200 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Key Terms Glossary</h2>
        <p className="text-gray-600 text-center mb-6">Hover or tap any term for its definition and authoritative source</p>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Core Concepts */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Core Concepts</h3>
            <div className="space-y-2">
              <div className="text-gray-700"><GlossaryTooltip termKey="liquid-biopsy" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="ctdna" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="cfdna" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="mrd" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="bloodpac" /></div>
            </div>
          </div>
          
          {/* Testing Approaches */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Testing Approaches</h3>
            <div className="space-y-2">
              <div className="text-gray-700"><GlossaryTooltip termKey="tumor-informed" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="tumor-naive" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="ngs" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="cgp" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="methylation" /></div>
            </div>
          </div>
          
          {/* Performance Metrics */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Performance Metrics</h3>
            <div className="space-y-2">
              <div className="text-gray-700"><GlossaryTooltip termKey="sensitivity" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="specificity" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="lod" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="vaf" /></div>
            </div>
          </div>
          
          {/* MRD & Response */}
          <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
            <h3 className="text-sm font-semibold text-orange-700 uppercase tracking-wide mb-3">MRD & Response</h3>
            <div className="space-y-2">
              <div className="text-gray-700"><GlossaryTooltip termKey="molecular-response" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="ctdna-clearance" /></div>
            </div>
            <p className="text-xs text-orange-600 mt-3">Per BLOODPAC MRD Lexicon</p>
          </div>
          
          {/* Regulatory & Clinical */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Regulatory & Clinical</h3>
            <div className="space-y-2">
              <div className="text-gray-700"><GlossaryTooltip termKey="nccn" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="companion-dx" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="fda-approved" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="ldt" /></div>
              <div className="text-gray-700"><GlossaryTooltip termKey="chip" /></div>
            </div>
          </div>
        </div>
        
        <p className="text-xs text-gray-500 text-center mt-4">
          Definitions sourced from NCI, BLOODPAC, FDA, ASCO, and Friends of Cancer Research
        </p>
      </div>

      {/* Authoritative Resources Section */}
      <div className="mt-12 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Authoritative Resources</h2>
        <p className="text-gray-600 text-center mb-6">OpenOnco terminology and standards are informed by these organizations</p>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* BLOODPAC */}
          <a 
            href="https://www.bloodpac.org" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-white rounded-xl p-4 border border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🔬</span>
              <span className="font-semibold text-gray-900 group-hover:text-emerald-600">BLOODPAC</span>
            </div>
            <p className="text-sm text-gray-600">Cancer Moonshot consortium developing liquid biopsy standards and the MRD Terminology Lexicon</p>
          </a>
          
          {/* Friends of Cancer Research */}
          <a 
            href="https://friendsofcancerresearch.org" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-white rounded-xl p-4 border border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🤝</span>
              <span className="font-semibold text-gray-900 group-hover:text-emerald-600">Friends of Cancer Research</span>
            </div>
            <p className="text-sm text-gray-600">ctMoniTR project validating ctDNA as an early efficacy endpoint in clinical trials</p>
          </a>
          
          {/* NCI */}
          <a 
            href="https://www.cancer.gov" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-white rounded-xl p-4 border border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🏛️</span>
              <span className="font-semibold text-gray-900 group-hover:text-emerald-600">National Cancer Institute</span>
            </div>
            <p className="text-sm text-gray-600">Authoritative definitions and the NCI Liquid Biopsy Consortium for early detection research</p>
          </a>
          
          {/* FDA */}
          <a 
            href="https://www.fda.gov/media/183874/download" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-white rounded-xl p-4 border border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">⚖️</span>
              <span className="font-semibold text-gray-900 group-hover:text-emerald-600">FDA Guidance</span>
            </div>
            <p className="text-sm text-gray-600">December 2024 guidance on ctDNA for early-stage solid tumor drug development</p>
          </a>
        </div>
        
        {/* Additional Resources */}
        <div className="mt-6 pt-6 border-t border-emerald-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 text-center">Additional Standards Bodies</h3>
          <div className="flex flex-wrap justify-center gap-3">
            <a 
              href="https://www.nccn.org/guidelines/guidelines-detail" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-sm font-medium text-gray-700 border border-gray-200 hover:border-violet-300 hover:text-violet-600 transition-colors"
            >
              📜 NCCN Guidelines
              <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <a 
              href="https://fnih.org/our-programs/international-liquid-biopsy-standardization-alliance-ilsa/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-sm font-medium text-gray-700 border border-gray-200 hover:border-cyan-300 hover:text-cyan-600 transition-colors"
            >
              🌐 ILSA (Global Standards)
              <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <a 
              href="https://www.lungevity.org/patients-care-partners/navigating-your-diagnosis/biomarker-testing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-sm font-medium text-gray-700 border border-gray-200 hover:border-pink-300 hover:text-pink-600 transition-colors"
            >
              💡 LUNGevity Patient Resources
              <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <a 
              href="https://ascopubs.org/doi/10.1200/EDBK-25-481114" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-sm font-medium text-gray-700 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
            >
              🎓 ASCO Education
              <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>

    </div>
  );
};


export default LearnPage;
