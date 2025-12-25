import { getSiteConfig } from '../data';

const AboutPage = () => {
  const siteConfig = getSiteConfig();
  const isAlz = false; // ALZ DISABLED

  if (isAlz) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">About OpenAlz</h1>
        <div className="prose prose-lg text-gray-700 space-y-6">
          <p>
            Hi, my name is <a href="https://www.linkedin.com/in/alexgdickinson/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700 underline">Alex Dickinson</a>. I also run <a href="https://openonco.org" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700 underline">OpenOnco</a>, a non-profit database of cancer diagnostic tests that I started in memory of my sister Ingrid, who died from a brain tumor when she was eleven.
          </p>
          <p>
            The same revolution in molecular diagnostics that's transforming cancer detection is now reaching Alzheimer's disease. Blood-based biomarkers like pTau217 and amyloid-beta ratios can now detect Alzheimer's pathology years before symptoms appear—and at a fraction of the cost of PET imaging.
          </p>
          <p>
            But this rapidly evolving landscape can be overwhelming. New tests are launching constantly, each with different technologies, performance characteristics, and availability. OpenAlz is an effort to collect, curate, and explain all the data on these tests—helping patients, caregivers, and clinicians make informed decisions.
          </p>
          <p>
            OpenAlz is a non-profit project, self-funded as an extension of my work on OpenOnco.
          </p>
        </div>
        <div className="mt-12 flex justify-center">
          <img 
            src="/IngridandAlex.jpeg" 
            alt="Ingrid and Alex" 
            className="rounded-xl shadow-lg max-w-md w-full"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">About</h1>
      <div className="prose prose-lg text-gray-700 space-y-6">
        <p>
          Hi, my name is <a href="https://www.linkedin.com/in/alexgdickinson/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 underline">Alex Dickinson</a>. Like many of you, my friends and family have been impacted by cancer throughout my life. Most significantly for me, my sister Ingrid died from a brain tumor when she was eleven and I was seven—you can see us together in the photo below.
        </p>
        <p>
          Professionally I've had the good fortune to stumble into the amazing world of cancer diagnostics—the people, companies, and technologies. Along the way I've become convinced that the emerging new generation of molecular cancer tests (largely enabled by next-generation sequencing) will have an extraordinary impact on cancer detection and treatment.
        </p>
        <p>
          Because these tests detect biomolecular events at tiny concentrations—now approaching one in a billion—this is a very complex field, and test data and options can overwhelm doctors and patients alike. This confusion will only increase as the number of tests rapidly expands due to both advances in the technology and the decision to maintain a low level of test regulation in the US.
        </p>
        <p>
          OpenOnco is an effort to collect, curate, and explain to both patients and their doctors all the data on all these tests.
        </p>
        <p>
          OpenOnco is a non-profit that I am self-funding in memory of my sister Ingrid.
        </p>
      </div>
      <div className="mt-12 flex justify-center">
        <img 
          src="/IngridandAlex.jpeg" 
          alt="Ingrid and Alex" 
          className="rounded-xl shadow-lg max-w-md w-full"
        />
      </div>
    </div>
  );
};

// ============================================
// How It Works Page
// ============================================

export default AboutPage;
