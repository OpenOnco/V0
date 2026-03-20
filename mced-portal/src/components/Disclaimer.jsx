export default function Disclaimer() {
  return (
    <div className="fixed bottom-0 inset-x-0 bg-amber-50 border-t border-amber-200 z-50">
      <div className="max-w-4xl mx-auto px-4 py-2.5 text-xs text-amber-800 text-center leading-relaxed">
        This tool is for informational purposes only and does not provide medical
        advice. MCED tests have not been FDA-approved for cancer screening. This is
        not a diagnostic tool and does not assess your personal cancer risk. All
        clinical data shown is from published studies and may not reflect real-world
        performance. Discuss any testing decisions with your healthcare provider.
      </div>
    </div>
  );
}
