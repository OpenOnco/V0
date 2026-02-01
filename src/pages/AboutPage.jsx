const AboutPage = () => {
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
