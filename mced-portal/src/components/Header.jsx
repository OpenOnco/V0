export default function Header() {
  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-blue-600">OpenOnco</span>
          <span className="text-slate-400">|</span>
          <span className="text-sm text-slate-600 font-medium">MCED Discussion Guide</span>
        </div>
        <a
          href="https://openonco.org"
          className="text-sm text-slate-500 hover:text-blue-600 transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          openonco.org
        </a>
      </div>
    </header>
  );
}
