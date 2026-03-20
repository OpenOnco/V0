import { useState, useCallback, useMemo, Fragment } from 'react';
import MatrixDot, { TIER_STYLES } from './MatrixDot';
import MatrixTooltip from './MatrixTooltip';
import TestDetailPanel from './TestDetailPanel';

const SORT_OPTIONS = [
  { value: 'alpha', label: 'A–Z' },
  { value: 'coverage', label: 'Detection coverage' },
];

/**
 * Comparison matrix: cancer types as columns, tests as rows,
 * traffic light dot at each intersection.
 *
 * Default sort: alphabetical by test name.
 * User-toggleable: detection coverage (green→amber→red→gray ranking).
 */
export default function ComparisonMatrix({ sortedTests, concerns, gaps }) {
  const [tooltip, setTooltip] = useState(null);
  const [expandedTestId, setExpandedTestId] = useState(null);
  const [sortBy, setSortBy] = useState('alpha');

  const columns = [
    ...concerns.map((c) => ({ cancer: c, isGap: false })),
    ...gaps.map((c) => ({ cancer: c, isGap: true })),
  ];

  // sortedTests from App is pre-sorted by detection coverage.
  // For alpha, re-sort by name.
  const displayTests = useMemo(() => {
    if (sortBy === 'alpha') {
      return [...sortedTests].sort((a, b) =>
        a.test.name.localeCompare(b.test.name)
      );
    }
    return sortedTests; // already sorted by coverage from logic layer
  }, [sortedTests, sortBy]);

  const handleShowTooltip = useCallback((data, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ data, position: { x: rect.left + rect.width / 2, y: rect.bottom } });
  }, []);

  const handleCloseTooltip = useCallback(() => setTooltip(null), []);

  const toggleDetail = (testId) => {
    setExpandedTestId((prev) => (prev === testId ? null : testId));
  };

  function getCellData(entry, cancer) {
    const allRows = [...entry.trafficLight.concernRows, ...entry.trafficLight.gapRows];
    return allRows.find((r) => r.cancer === cancer) || {
      cancer,
      tier: 'no-data',
      sensitivity: null,
      sampleSize: null,
    };
  }

  return (
    <div>
      {/* Sort toggle */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-slate-500">Sort by:</span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSortBy(opt.value)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              sortBy === opt.value
                ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto -mx-4 px-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        <table className="w-full border-collapse min-w-[400px]">
          <thead>
            <tr>
              <th
                className="sticky left-0 z-10 bg-slate-50 text-left p-2 border-b border-slate-200 min-w-[140px]"
              >
                <span className="text-xs font-medium text-slate-500">Test</span>
              </th>
              {columns.map((col) => (
                <th
                  key={col.cancer}
                  className="p-2 border-b border-slate-200 text-center align-bottom"
                  style={{ minWidth: 56, maxWidth: 72 }}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className="text-[11px] font-medium text-slate-700 leading-tight"
                      style={{
                        writingMode: 'vertical-lr',
                        transform: 'rotate(180deg)',
                        maxHeight: 90,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {col.cancer}
                    </span>
                    {col.isGap && (
                      <span className="text-[8px] text-rose-500 font-medium leading-none">
                        gap
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayTests.map((entry) => (
              <Fragment key={entry.test.id}>
                <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="sticky left-0 z-10 bg-white p-2 min-w-[140px]">
                    <button
                      className="text-left group"
                      onClick={() => toggleDetail(entry.test.id)}
                    >
                      <span className="text-[13px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {entry.test.name}
                      </span>
                      <br />
                      <span className="text-[11px] text-slate-400">
                        {entry.test.vendor}
                        {entry.test.listPrice
                          ? ` · $${entry.test.listPrice.toLocaleString()}`
                          : ''}
                      </span>
                    </button>
                  </td>
                  {entry.hasData ? (
                    columns.map((col) => {
                      const cell = getCellData(entry, col.cancer);
                      return (
                        <td key={col.cancer} className="p-1.5 text-center">
                          <MatrixDot
                            tier={cell.tier}
                            sensitivity={cell.sensitivity}
                            sampleSize={cell.sampleSize}
                            cancer={cell.cancer}
                            onShowTooltip={handleShowTooltip}
                          />
                        </td>
                      );
                    })
                  ) : (
                    <td
                      colSpan={columns.length}
                      className="p-2 text-center text-xs text-slate-400 italic"
                    >
                      Sensitivity data not yet available
                    </td>
                  )}
                </tr>
                {expandedTestId === entry.test.id && (
                  <TestDetailPanel
                    test={entry.test}
                    onClose={() => setExpandedTestId(null)}
                  />
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-4 px-1">
        {[
          { tier: 'good', label: '>50% published sensitivity' },
          { tier: 'ok', label: '25–50%' },
          { tier: 'bad', label: '≤25%' },
          { tier: 'no-data', label: 'no data' },
        ].map(({ tier, label }) => (
          <div key={tier} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: TIER_STYLES[tier].bg }}
            />
            <span className="text-[11px] text-slate-500">{label}</span>
          </div>
        ))}
      </div>

      <MatrixTooltip
        data={tooltip?.data}
        position={tooltip?.position || { x: 0, y: 0 }}
        onClose={handleCloseTooltip}
      />
    </div>
  );
}
