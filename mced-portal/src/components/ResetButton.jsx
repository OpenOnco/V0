export default function ResetButton({ onReset }) {
  return (
    <div className="text-right mt-1">
      <button
        onClick={onReset}
        className="text-[11px] text-gray-400 underline underline-offset-2 hover:text-gray-600 transition-colors"
      >
        Reset all
      </button>
    </div>
  );
}
