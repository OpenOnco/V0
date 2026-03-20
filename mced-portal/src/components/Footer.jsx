export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="text-xs text-slate-500 leading-relaxed text-center mb-4">
          <p>
            OpenOnco is an independent 501(c)(3) nonprofit. We do not sell,
            promote, or receive compensation from any test manufacturer. All
            clinical performance data is sourced from published peer-reviewed
            studies. MCED tests require a physician&apos;s order — this tool is
            designed to help you prepare for that conversation.
          </p>
        </div>
        <p className="text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} OpenOnco &middot;{' '}
          <a
            href="https://openonco.org"
            className="underline hover:text-blue-600"
            target="_blank"
            rel="noopener noreferrer"
          >
            openonco.org
          </a>
        </p>
      </div>
    </footer>
  );
}
