import { tierInfo } from '../logic/tierInfo';
import NoDataStamp from './NoDataStamp';

export default function TestCard({ test, selectedCancers }) {
  const hasData = Object.keys(test.cancers).length > 0;
  const hasSel = selectedCancers.length > 0;

  const selectedSet = new Set(selectedCancers);
  const otherCount = hasData
    ? Object.keys(test.cancers).filter((c) => !selectedSet.has(c)).length
    : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-4 relative overflow-hidden">
      {!hasData && <NoDataStamp />}
      <div className={`flex items-stretch ${!hasData ? 'opacity-40' : ''}`}>
        {/* Column 1: Test info */}
        <div className="w-[130px] shrink-0">
          <div className="text-[15px] font-medium text-gray-900 leading-tight truncate" title={test.name}>{test.name}</div>
          <span className="text-xs text-gray-400 block mt-0.5 truncate" title={test.vendor}>{test.vendor}</span>
        </div>

        {/* Column 2: Traffic lights */}
        {hasSel && (
          <div className="flex-1 min-w-0 px-4 border-l border-gray-100">
            {hasData ? (
              <>
                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mt-2.5">
                  Your selected cancers
                </div>
                <div className="flex flex-col gap-1.5 mt-1">
                  {selectedCancers.map((c) => {
                    const s = test.cancers[c];
                    const tier = tierInfo(s);
                    const pct = s != null ? `${s.toFixed(1)}%` : '--';
                    return (
                      <div key={c} className="flex items-center gap-2.5">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: tier.color }}
                        />
                        <span className="text-[13px] text-gray-600 flex-1">{c}</span>
                        <span className="text-xs text-gray-400 tabular-nums min-w-[48px] text-right">
                          {pct}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Column 3: Cancer count */}
        {otherCount > 0 && (
          <div className="shrink-0 px-4 border-l border-gray-200 flex flex-col items-center justify-center min-w-[90px]">
            <div className="text-[32px] font-medium text-gray-900 leading-none">
              {otherCount}
            </div>
            <div className="text-[10px] text-gray-400 text-center leading-snug mt-1">
              {hasSel ? (
                <>additional<br />cancers<br />may be<br />detected<br />early</>
              ) : (
                <>cancers<br />may be<br />detected<br />early</>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
