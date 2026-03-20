import { useState, useMemo } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Disclaimer from './components/Disclaimer';
import IntakeForm from './components/IntakeForm';
import ResultsPage from './components/ResultsPage';
import { useTestData } from './hooks/useTestData';
import { useIntakeForm } from './hooks/useIntakeForm';
import { buildConcernList } from './logic/buildConcernList';
import { identifyScreeningGaps } from './logic/identifyScreeningGaps';
import { sortTests, sortByTotalCancers } from './logic/sortTests';

export default function App() {
  const { tests, loading, error } = useTestData();
  const { form, step, TOTAL_STEPS, update, next, back, reset } = useIntakeForm();
  const [view, setView] = useState('intake');

  const results = useMemo(() => {
    if (view !== 'results' || tests.length === 0) return null;

    const concerns = buildConcernList(form);
    const gaps = identifyScreeningGaps(form);
    const allEqual = concerns.length === 0 && gaps.length === 0;

    const sorted = allEqual
      ? sortByTotalCancers(tests).map((test) => ({
          test,
          trafficLight: { concernRows: [], gapRows: [], hasAnySensitivityData: false },
          greenCount: 0,
          amberCount: 0,
          redCount: 0,
          noDataCount: 0,
          hasData: false,
        }))
      : sortTests(tests, concerns, gaps);

    return { sorted, concerns, gaps, allEqual };
  }, [view, tests, form]);

  const handleSubmit = () => setView('results');
  const handleStartOver = () => {
    reset();
    setView('intake');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 px-4 py-8 pb-16">
        {loading && (
          <div className="max-w-xl mx-auto text-center py-12">
            <div className="inline-block h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="mt-3 text-slate-500">Loading test data...</p>
          </div>
        )}

        {error && (
          <div className="max-w-xl mx-auto bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <p className="text-red-800 font-medium">Failed to load test data</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <p className="text-red-500 text-xs mt-2">
              Try refreshing the page or visit{' '}
              <a href="https://openonco.org/screen" className="underline">
                openonco.org/screen
              </a>
            </p>
          </div>
        )}

        {!loading && !error && view === 'intake' && (
          <IntakeForm
            form={form}
            step={step}
            totalSteps={TOTAL_STEPS}
            onUpdate={update}
            onNext={next}
            onBack={back}
            onSubmit={handleSubmit}
          />
        )}

        {!loading && !error && view === 'results' && results && (
          <ResultsPage
            form={form}
            sortedTests={results.sorted}
            concerns={results.concerns}
            gaps={results.gaps}
            allEqual={results.allEqual}
            onStartOver={handleStartOver}
          />
        )}
      </main>

      <Footer />
      <Disclaimer />
    </div>
  );
}
