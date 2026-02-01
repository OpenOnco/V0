import { useState, useEffect } from 'react';
import { getStoredPersona } from '../utils/persona';
import DatabaseSummary from '../components/DatabaseSummary';
import OpennessAward from '../components/OpennessAward';

const FAQItem = ({ question, answer, isOpen, onClick }) => (
  <div className="border-b border-gray-200 last:border-b-0">
    <button
      onClick={onClick}
      className="w-full py-5 px-6 flex justify-between items-center text-left hover:bg-gray-50 transition-colors"
    >
      <span className="text-lg font-medium text-gray-900 pr-4">{question}</span>
      <svg 
        className={`w-5 h-5 text-gray-500 transform transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {isOpen && (
      <div className="pb-5 px-6 pr-12">
        <div className="prose prose-lg text-gray-600">{answer}</div>
      </div>
    )}
  </div>
);

const FAQPage = () => {
  const [openIndex, setOpenIndex] = useState(null);
  const [persona, setPersona] = useState(getStoredPersona() || 'rnd');

  // Listen for persona changes
  useEffect(() => {
    const handlePersonaChange = (e) => setPersona(e.detail);
    window.addEventListener('personaChanged', handlePersonaChange);
    return () => window.removeEventListener('personaChanged', handlePersonaChange);
  }, []);

  // Patient-friendly FAQs
  const patientFaqs = [
    {
      question: "What is OpenOnco?",
      answer: (
        <p>
          OpenOnco is a free resource that helps you understand the different blood tests available for cancer detection, treatment guidance, and monitoring. We collect information about these tests in one place so you can learn about your options and have informed conversations with your doctor.
        </p>
      )
    },
    {
      question: "What kinds of tests do you cover?",
      answer: (
        <div className="space-y-3">
          <p>We cover four types of cancer blood tests:</p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li><strong>Early Detection</strong> — Tests that look for signs of cancer before symptoms appear</li>
            <li><strong>Treatment Guidance</strong> — Tests that analyze your tumor to find the best treatment options</li>
            <li><strong>Treatment Monitoring</strong> — Tests that track whether your treatment is working</li>
            <li><strong>Post-Treatment Surveillance</strong> — Tests that watch for cancer returning after treatment</li>
          </ul>
        </div>
      )
    },
    {
      question: "How do I know which test is right for me?",
      answer: (
        <p>
          The right test depends on your specific situation—your cancer type, stage, and where you are in your treatment journey. We recommend using our chat feature to describe your situation, then discussing the options with your oncologist. Your doctor can help determine which test makes sense based on your medical history and current needs.
        </p>
      )
    },
    {
      question: "Will my insurance cover these tests?",
      answer: (
        <p>
          Coverage varies by test and insurance plan. Many tests have Medicare coverage, and some have coverage from major private insurers. We show what we know about coverage for each test, but we recommend checking with both the testing company and your insurance to confirm coverage before ordering. Many testing companies have patient assistance programs if cost is a concern.
        </p>
      )
    },
    {
      question: "What's the difference between a blood test and a tissue biopsy?",
      answer: (
        <p>
          Traditional biopsies require removing a piece of tumor tissue through surgery or a needle procedure. Many of the newer tests we cover are "liquid biopsies"—they analyze tiny pieces of tumor DNA that float in your bloodstream. This means they only need a simple blood draw, which is less invasive and can be repeated easily to track changes over time.
        </p>
      )
    },
    {
      question: "How accurate are these tests?",
      answer: (
        <p>
          Accuracy varies by test and what it's designed to detect. We show performance information for each test when available. No test is 100% accurate—there's always some chance of false positives (saying cancer is present when it isn't) or false negatives (missing cancer that is present). Your doctor can help interpret results and may recommend additional testing if needed.
        </p>
      )
    },
    {
      question: "Can I order these tests myself?",
      answer: (
        <p>
          Most of these tests require a doctor's order. However, your oncologist may not be aware of all available options. You can use OpenOnco to learn about tests that might be relevant to your situation, then ask your doctor if they would be appropriate for you.
        </p>
      )
    },
    {
      question: "How current is this information?",
      answer: (
        <p>
          We update our database regularly as new tests launch and new information becomes available. However, this field moves quickly—always verify current availability, coverage, and pricing directly with the testing company or your healthcare provider.
        </p>
      )
    }
  ];

  // OpenOnco FAQs (R&D/Medical)
  const oncoFaqs = [
    {
      question: "What types of tests does OpenOnco cover?",
      answer: (
        <p>
          OpenOnco focuses on advanced molecular diagnostics—laboratory-developed tests (LDTs) and services that patients and clinicians can access directly. We cover four categories: <strong>Early Cancer Detection (ECD)</strong> for screening, <strong>Treatment Decision Support (TDS)</strong> for guiding treatment decisions in newly diagnosed patients, <strong>Treatment Response Monitoring (TRM)</strong> for patients on active treatment, and <strong>Minimal Residual Disease (MRD)</strong> for surveillance after treatment. We include tests using various technologies—genomic sequencing, methylation analysis, protein biomarkers, and more—as long as they're orderable clinical services rather than reagent kits laboratories must validate themselves.
        </p>
      )
    },
    {
      question: "Why aren't certain tests included in your database?",
      answer: (
        <div className="space-y-3">
          <p>
            We focus on tests that clinicians can order or patients can request directly. This means we exclude:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>IVD kits sold to laboratories</strong> (e.g., Oncomine Dx Target Test, TruSight Oncology Comprehensive)—these require labs to purchase, validate, and run themselves</li>
            <li><strong>Research-use-only (RUO) assays</strong> not available for clinical ordering</li>
            <li><strong>Tests no longer commercially available</strong></li>
          </ul>
          <p>
            If you believe we're missing a test that should be included, please use the Submissions tab to let us know.
          </p>
        </div>
      )
    },
    {
      question: "How do you decide what information to include for each test?",
      answer: (
        <p>
          We prioritize publicly available, verifiable information from peer-reviewed publications, FDA submissions, company websites, and clinical guidelines (like NCCN). Every data point includes citations so you can verify the source. We focus on information most relevant to test selection: performance metrics (sensitivity, specificity, LOD), regulatory status, turnaround time, sample requirements, cancer types covered, and reimbursement status.
        </p>
      )
    },
    {
      question: "How often is the database updated?",
      answer: (
        <p>
          We update the database regularly as new tests launch, FDA approvals occur, or performance data is published. The build date shown on the Data Download page indicates when the current version was deployed. You can also check the "Recently Added" section on the home page to see the latest additions.
        </p>
      )
    },
    {
      question: "What does it mean when a test is 'NCCN Recommended'?",
      answer: (
        <p>
          This indicates that the test covers biomarkers recommended in NCCN (National Comprehensive Cancer Network) clinical guidelines for the relevant cancer type(s). It's important to note that NCCN recommends testing for specific biomarkers but does not endorse specific commercial assays by name. A test marked as "NCCN Recommended" means it can detect the biomarkers that NCCN guidelines say should be tested—not that NCCN has specifically endorsed that particular test.
        </p>
      )
    },
    {
      question: "What's the difference between FDA-approved and LDT tests?",
      answer: (
        <div className="space-y-3">
          <p>
            <strong>FDA-approved/cleared tests</strong> have been reviewed by the FDA and meet specific analytical and clinical validation requirements. They often have companion diagnostic (CDx) claims linking test results to specific therapies.
          </p>
          <p>
            <strong>Laboratory-developed tests (LDTs)</strong> are developed and validated by individual CLIA-certified laboratories. While they must meet CLIA quality standards, they haven't undergone FDA premarket review. Many high-quality tests are LDTs—FDA approval status alone doesn't determine clinical utility.
          </p>
        </div>
      )
    },
    {
      question: "How should I interpret sensitivity and specificity numbers?",
      answer: (
        <div className="space-y-3">
          <p>
            <strong>Sensitivity</strong> measures how well a test detects disease when it's present (true positive rate). A 90% sensitivity means the test correctly identifies 90% of people who have the condition.
          </p>
          <p>
            <strong>Specificity</strong> measures how well a test correctly identifies people without disease (true negative rate). A 99% specificity means only 1% of healthy people will get a false positive.
          </p>
          <p>
            Important: These numbers can vary significantly based on the patient population, cancer stage, and how the study was conducted. Always look at the context and study population when comparing tests.
          </p>
        </div>
      )
    },
    {
      question: "Is OpenOnco affiliated with any test vendors?",
      answer: (
        <p>
          No. OpenOnco is an independent resource with no financial relationships with test vendors. We don't accept advertising or sponsorship. Our goal is to provide unbiased, transparent information to help patients and clinicians make informed decisions.
        </p>
      )
    },
    {
      question: "What standards and terminology does OpenOnco follow?",
      answer: (
        <div className="space-y-3">
          <p>
            OpenOnco aligns its terminology and categories with authoritative standards bodies and research consortiums to ensure consistency with the broader field. Our key references include:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>BLOODPAC MRD Lexicon</strong> — The Blood Profiling Atlas in Cancer consortium published a standardized terminology lexicon for MRD testing in 2025. We use their definitions for terms like "tumor-informed," "tumor-naïve," "molecular response," and "ctDNA clearance."
              <br /><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11897061/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 text-sm">→ View BLOODPAC MRD Lexicon</a>
            </li>
            <li>
              <strong>FDA ctDNA Guidance (December 2024)</strong> — The FDA's guidance document on using ctDNA for early-stage solid tumor drug development informs how we describe regulatory pathways and clinical endpoints.
              <br /><a href="https://www.fda.gov/media/183874/download" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 text-sm">→ View FDA Guidance (PDF)</a>
            </li>
            <li>
              <strong>Friends of Cancer Research ctMoniTR</strong> — This multi-stakeholder project is validating ctDNA as an early efficacy endpoint. We reference their framework for treatment response monitoring.
              <br /><a href="https://friendsofcancerresearch.org/ctdna/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 text-sm">→ View ctMoniTR Project</a>
            </li>
            <li>
              <strong>NCI Cancer Dictionary</strong> — For patient-facing definitions of terms like "liquid biopsy" and "ctDNA," we reference the National Cancer Institute's authoritative definitions.
              <br /><a href="https://www.cancer.gov/publications/dictionaries/cancer-terms/def/liquid-biopsy" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 text-sm">→ View NCI Dictionary</a>
            </li>
            <li>
              <strong>NCCN Clinical Practice Guidelines</strong> — When we indicate a test covers "NCCN-recommended" biomarkers, we're referring to the National Comprehensive Cancer Network's evidence-based guidelines.
              <br /><a href="https://www.nccn.org/guidelines/guidelines-detail" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 text-sm">→ View NCCN Guidelines</a>
            </li>
          </ul>
          <p>
            For patient education resources, we recommend <a href="https://www.lungevity.org/patients-care-partners/navigating-your-diagnosis/biomarker-testing" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700">LUNGevity's biomarker testing guides</a> and the <a href="https://noonemissed.org/lungcancer/us" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700">No One Missed campaign</a>.
          </p>
          <p className="text-sm text-gray-500 mt-4">
            You'll find links to these resources throughout OpenOnco on each category page under "Standards & Resources."
          </p>
        </div>
      )
    },
    {
      question: "How does the AI chat feature work, and can I trust its answers?",
      answer: (
        <div className="space-y-3">
          <p>
            Our chat feature is powered by Anthropic's Claude AI. We've designed it to <strong>only reference information from our test database</strong>—it cannot browse the internet or access external sources during your conversation. This means Claude's answers are grounded in the same curated, cited data you see throughout OpenOnco.
          </p>
          <p>
            However, <strong>AI language models can still make mistakes</strong>. They may occasionally misinterpret questions, make errors in reasoning, or present information in misleading ways. This is a limitation of current AI technology, not specific to our implementation.
          </p>
          <p>
            <strong>We strongly recommend:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Cross-checking any important information with vendor websites and official product documentation</li>
            <li>Verifying clinical claims with peer-reviewed publications (we provide citations throughout the database)</li>
            <li>If you're a patient, discussing test options with your doctor or healthcare provider before making decisions</li>
          </ul>
          <p>
            The chat is best used as a starting point for exploration—not as a definitive source for clinical decision-making.
          </p>
        </div>
      )
    },
    {
      question: "Can I download the data?",
      answer: (
        <p>
          Yes! Visit the Data Download tab to download the complete database in JSON format. The data is freely available for research, clinical decision support, or other non-commercial purposes.
        </p>
      )
    },
    {
      question: "How can I report an error or suggest a correction?",
      answer: (
        <p>
          Please use the Submissions tab and select "Request Changes to Test Data." Include the specific test name, the field that needs correction, and ideally a citation for the correct information. We take data accuracy seriously and will review all submissions.
        </p>
      )
    },
    {
      question: "What's the difference between the Patient and Clinician views?",
      answer: (
        <p>
          The Patient view simplifies information and focuses on practical questions: What does this test do? Is it covered by insurance? What's involved in getting tested? The Clinician and Academic/Industry views show more detailed technical information including performance metrics, FDA status, methodology details, and clinical validation data.
        </p>
      )
    },
    {
      question: "How do I contact OpenOnco?",
      answer: (
        <p>
          The best way to reach us is through the Submissions tab. Select the appropriate category for your inquiry—whether it's suggesting a new test, requesting data corrections, or providing general feedback. We review all submissions and will respond if needed.
        </p>
      )
    },
    {
      question: "What is the Openness Score?",
      answer: (
        <div className="space-y-4">
          <p>
            The OpenOnco Openness Score measures how completely vendors disclose key information about their tests. 
            It rewards vendors who publish pricing, performance data, and clinical evidence—information that helps 
            patients and clinicians make informed decisions. Vendors are ranked by their average score across all tests.
          </p>
          
          <p className="font-medium text-gray-800">How is it calculated?</p>
          <p>Each test is scored based on disclosure of key fields (weights sum to 100):</p>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Field</th>
                  <th className="text-center py-2 px-3 font-semibold text-gray-700 border-b">Weight</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">Rationale</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                <tr className="border-b"><td className="py-2 px-3 font-medium">Price</td><td className="text-center py-2 px-3 font-bold text-amber-600">30%</td><td className="py-2 px-3">Hardest to find, gold standard of openness</td></tr>
                <tr className="border-b bg-gray-50"><td className="py-2 px-3 font-medium">Publications</td><td className="text-center py-2 px-3 font-bold text-amber-600">15%</td><td className="py-2 px-3">Peer-reviewed evidence base</td></tr>
                <tr className="border-b"><td className="py-2 px-3 font-medium">Turnaround Time</td><td className="text-center py-2 px-3 font-bold text-amber-600">10%</td><td className="py-2 px-3">Practical info for clinicians</td></tr>
                <tr className="border-b bg-gray-50"><td className="py-2 px-3 font-medium">Sample Info</td><td className="text-center py-2 px-3 font-bold text-amber-600">10%</td><td className="py-2 px-3">Blood volume, sample type, or category</td></tr>
                <tr className="border-b"><td className="py-2 px-3 font-medium">Trial Participants</td><td className="text-center py-2 px-3 font-bold text-amber-600">5%</td><td className="py-2 px-3">Clinical evidence depth</td></tr>
                <tr className="border-b bg-blue-50"><td className="py-2 px-3 font-medium italic" colSpan="3">+ Category-Specific Metrics (30%)</td></tr>
                <tr className="border-b bg-gray-50"><td className="py-2 px-3 pl-6 text-xs">ECD (Screening)</td><td className="text-center py-2 px-3 text-xs">30%</td><td className="py-2 px-3 text-xs">Sensitivity + Specificity (cancer detection)</td></tr>
                <tr className="border-b"><td className="py-2 px-3 pl-6 text-xs">MRD</td><td className="text-center py-2 px-3 text-xs">30%</td><td className="py-2 px-3 text-xs">LOD (limit of detection)</td></tr>
                <tr className="border-b bg-gray-50"><td className="py-2 px-3 pl-6 text-xs">TRM</td><td className="text-center py-2 px-3 text-xs">30%</td><td className="py-2 px-3 text-xs">Sensitivity + Specificity (mutation detection)</td></tr>
                <tr className="border-b"><td className="py-2 px-3 pl-6 text-xs">TDS (CGP)</td><td className="text-center py-2 px-3 text-xs">30%</td><td className="py-2 px-3 text-xs">Genes Analyzed + CDx Claims</td></tr>
              </tbody>
              <tfoot>
                <tr className="bg-amber-50 border-t-2 border-amber-200"><td className="py-2 px-3 font-bold">Total</td><td className="text-center py-2 px-3 font-bold text-amber-700">100%</td><td className="py-2 px-3"></td></tr>
              </tfoot>
            </table>
          </div>
          
          <p className="font-medium text-gray-800 mt-4">Why category-normalized scoring?</p>
          <p>
            Different test categories have different "standard" metrics. CGP tests don't report sensitivity/specificity 
            like screening tests do — they report panel size and companion diagnostic claims. MRD tests focus on limit 
            of detection. By normalizing per-category, we compare apples to apples.
          </p>
          
          <p className="font-medium text-gray-800 mt-4">Who is eligible for ranking?</p>
          <p>
            Vendors must have <strong>2 or more tests</strong> in the OpenOnco database to qualify. The vendor's 
            score is the <strong>average</strong> across all their tests. This prevents a single well-documented 
            test from dominating while encouraging comprehensive disclosure across product portfolios.
          </p>
          
          <p className="font-medium text-gray-800 mt-4">Why these weights?</p>
          <p>
            <strong>Price (30%)</strong> is weighted highest because it's the most commonly withheld information 
            and critically important for patients and healthcare systems. <strong>Category-specific metrics (30%)</strong> are 
            essential for clinical decision-making but vary by test type. <strong>Publications (15%)</strong> demonstrate commitment to 
            independent validation. Practical details like <strong>TAT and sample requirements (15% combined)</strong> help 
            with care coordination.
          </p>
          
          <p className="font-medium text-gray-800 mt-4">How can vendors improve their score?</p>
          <p>
            Publish your list price, disclose the key performance metrics for your test category, maintain an 
            active publication record, and provide clear sample requirements. Vendors can submit updated information 
            through our Submissions page.
          </p>
        </div>
      )
    }
  ];

  const faqs = persona === 'patient' ? patientFaqs : oncoFaqs;

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h1>
      <p className="text-gray-600 mb-8">
        {persona === 'patient'
          ? "Answers to common questions about cancer blood tests and how OpenOnco can help you."
          : "Common questions about OpenOnco, our data, and how to use the platform."}
      </p>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-200">
        {faqs.map((faq, index) => (
          <FAQItem
            key={index}
            question={faq.question}
            answer={faq.answer}
            isOpen={openIndex === index}
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
          />
        ))}
      </div>

      {/* Openness Ranking - Hidden on mobile, only show for R&D/Medical */}
      {persona !== 'patient' && (
        <div className="hidden md:block mt-8">
          <OpennessAward />
        </div>
      )}

      {/* Database Summary - Hidden on mobile, only show for R&D/Medical */}
      {persona !== 'patient' && (
        <div className="hidden md:block mt-6">
          <DatabaseSummary />
        </div>
      )}
    </div>
  );
};

// ============================================

export default FAQPage;
