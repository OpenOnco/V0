export default function TestDetailPanel({ test, onClose }) {
  const {
    name,
    vendor,
    detectedCancerTypes,
    fdaStatus,
    sensitivity,
    specificity,
    listPrice,
  } = test;

  return (
    <tr>
      <td colSpan={999} className="p-0">
        <div className="bg-slate-50 border-t border-b border-slate-200 px-4 py-3">
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-semibold text-slate-900">{name}</h4>
            <button
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
            {listPrice && (
              <div>
                <span className="text-slate-500 text-xs">Price</span>
                <p className="font-medium">${listPrice.toLocaleString()}</p>
              </div>
            )}
            {sensitivity != null && (
              <div>
                <span className="text-slate-500 text-xs">Overall sensitivity</span>
                <p className="font-medium">{sensitivity}%</p>
              </div>
            )}
            {specificity != null && (
              <div>
                <span className="text-slate-500 text-xs">Specificity</span>
                <p className="font-medium">{specificity}%</p>
              </div>
            )}
            {fdaStatus && (
              <div>
                <span className="text-slate-500 text-xs">FDA status</span>
                <p className="font-medium text-xs">{fdaStatus}</p>
              </div>
            )}
          </div>
          {detectedCancerTypes && (
            <div className="mb-2">
              <span className="text-slate-500 text-xs">
                All detected cancer types ({detectedCancerTypes.length}):
              </span>
              <p className="text-sm text-slate-700 mt-0.5">
                {detectedCancerTypes.join(', ')}
              </p>
            </div>
          )}
          <a
            href={`https://openonco.org/screen?test=${test.id}`}
            className="text-xs text-blue-600 underline hover:text-blue-700"
            target="_blank"
            rel="noopener noreferrer"
          >
            View full details on OpenOnco
          </a>
        </div>
      </td>
    </tr>
  );
}
