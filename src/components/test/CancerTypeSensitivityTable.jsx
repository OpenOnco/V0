import React, { useState, useMemo } from 'react';

/**
 * Per-cancer-type/per-stage sensitivity table for MCED tests.
 * Renders inside TestDetailModal for tests with cancerTypeSensitivity data.
 */

const INITIAL_ROWS = 12;

function pct(detected, total) {
  if (!total || total === 0) return null;
  return (detected / total) * 100;
}

function colorClass(value) {
  if (value === null || value === undefined) return 'text-slate-300';
  if (value < 20) return 'text-red-600';
  if (value < 50) return 'text-orange-600';
  if (value < 75) return 'text-emerald-500';
  return 'text-emerald-600';
}

function SensCell({ detected, total }) {
  if (detected === undefined || total === undefined) {
    return <td className="px-2 py-1.5 text-center text-slate-300 text-sm">—</td>;
  }
  const value = pct(detected, total);
  const lowN = total < 10;
  return (
    <td className={`px-2 py-1.5 text-center ${lowN ? 'opacity-60' : ''}`}>
      <div className={`text-sm font-medium ${colorClass(value)}`}>
        {value !== null ? value.toFixed(1) + '%' : '—'}
        {lowN && <span className="ml-0.5 text-[10px]" title={`Low sample size (n=${total})`}>⚠️</span>}
      </div>
      <div className="text-[10px] text-slate-400">{detected}/{total}</div>
    </td>
  );
}

function EarlyCell({ stageI, stageII }) {
  if (!stageI && !stageII) {
    return <td className="px-2 py-1.5 text-center text-slate-300 text-sm bg-blue-50/50">—</td>;
  }
  const d = (stageI?.detected || 0) + (stageII?.detected || 0);
  const t = (stageI?.total || 0) + (stageII?.total || 0);
  if (t === 0) {
    return <td className="px-2 py-1.5 text-center text-slate-300 text-sm bg-blue-50/50">—</td>;
  }
  const value = pct(d, t);
  const lowN = t < 10;
  return (
    <td className={`px-2 py-1.5 text-center bg-blue-50/50 ${lowN ? 'opacity-60' : ''}`}>
      <div className={`text-sm font-medium ${colorClass(value)}`}>
        {value !== null ? value.toFixed(1) + '%' : '—'}
        {lowN && <span className="ml-0.5 text-[10px]" title={`Low sample size (n=${t})`}>⚠️</span>}
      </div>
      <div className="text-[10px] text-slate-400">{d}/{t}</div>
    </td>
  );
}

export default function CancerTypeSensitivityTable({ test }) {
  const data = test.cancerTypeSensitivity;
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  const [sortCol, setSortCol] = useState('n');
  const [sortDir, setSortDir] = useState('desc');
  const [expanded, setExpanded] = useState(false);

  const fpr = test.specificity ? (100 - test.specificity).toFixed(1) : null;

  const sorted = useMemo(() => {
    const getValue = (row) => {
      switch (sortCol) {
        case 'n': return row.overall?.total || 0;
        case 'stageI': return pct(row.stageI?.detected, row.stageI?.total) ?? -1;
        case 'stageII': return pct(row.stageII?.detected, row.stageII?.total) ?? -1;
        case 'early': {
          const d = (row.stageI?.detected || 0) + (row.stageII?.detected || 0);
          const t = (row.stageI?.total || 0) + (row.stageII?.total || 0);
          return t > 0 ? pct(d, t) : -1;
        }
        case 'stageIII': return pct(row.stageIII?.detected, row.stageIII?.total) ?? -1;
        case 'stageIV': return pct(row.stageIV?.detected, row.stageIV?.total) ?? -1;
        case 'overall': return pct(row.overall?.detected, row.overall?.total) ?? -1;
        default: return row.overall?.total || 0;
      }
    };
    return [...data].sort((a, b) => {
      const aVal = getValue(a);
      const bVal = getValue(b);
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [data, sortCol, sortDir]);

  const visible = expanded ? sorted : sorted.slice(0, INITIAL_ROWS);
  const hasMore = sorted.length > INITIAL_ROWS;

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const arrow = (col) => sortCol === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';

  // Totals
  const totalN = data.reduce((s, r) => s + (r.overall?.total || 0), 0);
  const totalDetected = data.reduce((s, r) => s + (r.overall?.detected || 0), 0);

  return (
    <div>
      {/* Context bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 mb-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
        <span>
          <span className="font-medium text-slate-700">Sensitivity:</span>{' '}
          {test.sensitivity}% <span className="text-slate-400">({test.sensitivityType || 'observed'})</span>
        </span>
        {test.incidenceAdjustedSensitivity && (
          <span>
            <span className="font-medium text-slate-700">IAS:</span>{' '}
            {test.incidenceAdjustedSensitivity}% <span className="text-slate-400">(SEER-weighted)</span>
          </span>
        )}
        <span>
          <span className="font-medium text-slate-700">Specificity:</span>{' '}
          {test.specificity}% {fpr && <span className="text-slate-400">({fpr}% FPR)</span>}
        </span>
        {test.ppv && (
          <span>
            <span className="font-medium text-slate-700">PPV:</span> {test.ppv}%
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-sm border-collapse min-w-[700px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
              <th className="text-left px-2 py-2 font-medium cursor-pointer hover:text-slate-900" onClick={() => handleSort('name')}>
                Cancer Type
              </th>
              <th className="text-center px-2 py-2 font-medium cursor-pointer hover:text-slate-900 w-12" onClick={() => handleSort('n')}>
                n{arrow('n')}
              </th>
              <th className="text-center px-2 py-2 font-medium cursor-pointer hover:text-slate-900" onClick={() => handleSort('stageI')}>
                I{arrow('stageI')}
              </th>
              <th className="text-center px-2 py-2 font-medium cursor-pointer hover:text-slate-900" onClick={() => handleSort('stageII')}>
                II{arrow('stageII')}
              </th>
              <th className="text-center px-2 py-2 font-medium cursor-pointer hover:text-slate-900 bg-blue-50/80" onClick={() => handleSort('early')}>
                I+II{arrow('early')}
              </th>
              <th className="text-center px-2 py-2 font-medium cursor-pointer hover:text-slate-900" onClick={() => handleSort('stageIII')}>
                III{arrow('stageIII')}
              </th>
              <th className="text-center px-2 py-2 font-medium cursor-pointer hover:text-slate-900" onClick={() => handleSort('stageIV')}>
                IV{arrow('stageIV')}
              </th>
              <th className="text-center px-2 py-2 font-medium cursor-pointer hover:text-slate-900" onClick={() => handleSort('overall')}>
                All{arrow('overall')}
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={row.cancerType} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                <td className="px-2 py-1.5 text-slate-800 text-sm font-medium whitespace-nowrap">{row.cancerType}</td>
                <td className="px-2 py-1.5 text-center text-slate-500 text-sm">{row.overall?.total || '—'}</td>
                <SensCell detected={row.stageI?.detected} total={row.stageI?.total} />
                <SensCell detected={row.stageII?.detected} total={row.stageII?.total} />
                <EarlyCell stageI={row.stageI} stageII={row.stageII} />
                <SensCell detected={row.stageIII?.detected} total={row.stageIII?.total} />
                <SensCell detected={row.stageIV?.detected} total={row.stageIV?.total} />
                <SensCell detected={row.overall?.detected} total={row.overall?.total} />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-100 font-medium">
              <td className="px-2 py-2 text-slate-700 text-sm">Total</td>
              <td className="px-2 py-2 text-center text-slate-600 text-sm">{totalN}</td>
              <td colSpan={3} className="px-2 py-2 text-center text-xs text-slate-500">
                Observed: {totalN > 0 ? (totalDetected / totalN * 100).toFixed(1) : '—'}%
              </td>
              <td colSpan={2} className="px-2 py-2 text-center text-xs text-slate-500">
                {test.incidenceAdjustedSensitivity ? `IAS: ${test.incidenceAdjustedSensitivity}%` : ''}
              </td>
              <td className="px-2 py-2 text-center text-sm">
                <span className={colorClass(totalN > 0 ? totalDetected / totalN * 100 : null)}>
                  {totalN > 0 ? (totalDetected / totalN * 100).toFixed(1) + '%' : '—'}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Show more / less */}
      {hasMore && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-2 text-sm text-brand-600 hover:text-brand-800 font-medium"
        >
          {expanded ? 'Show fewer' : `Show all ${sorted.length} cancer types`}
        </button>
      )}

      {/* Citation */}
      {test.cancerTypeSensitivityCitations && (
        <p className="mt-3 text-[11px] text-slate-400">
          Source: {test.cancerTypeSensitivityCitations}
        </p>
      )}
    </div>
  );
}
