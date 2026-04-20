import React from 'react';

export function StockGadget({ live, marketOpen }) {
  const sorted    = [...live].sort((a, b) => b.chg - a.chg);
  const gains     = sorted.filter(s => s.chg >= 0);
  const losses    = sorted.filter(s => s.chg <  0);
  const gainSum   = gains.reduce((s, x) => s + x.chg, 0);
  const lossSum   = Math.abs(losses.reduce((s, x) => s + x.chg, 0));
  const total     = Math.max(gainSum + lossSum, 1);
  const gainFlex  = gainSum / total;
  const lossFlex  = lossSum / total;

  return (
    <div className="sg">
      <div className="sg-head">
        <div className="sg-ttl">WATCH</div>
        <div className="sg-sub mono">
          {marketOpen
            ? <><span className="dot-live" />LIVE</>
            : <span style={{ color: '#94a3b8' }}>CLOSED</span>
          }
        </div>
      </div>
      <div className="sg-tot mono">
        <span className="up">+{Math.round(gainSum)}%</span>
        <span className="sep">&middot;</span>
        <span className="dn">&minus;{Math.round(lossSum)}%</span>
      </div>

      <div className="sg-body">
        {/* left: two proportional arrows */}
        <div className="sg-axis">
          <div className="sg-ax gain" style={{ flex: gainFlex }}>
            <div className="sg-arrowhead up">
              <svg viewBox="0 0 24 12"><polygon points="12,0 24,12 0,12" fill="currentColor"/></svg>
            </div>
            <div className="sg-shaft up" />
          </div>
          <div className="sg-axzero mono">0</div>
          <div className="sg-ax loss" style={{ flex: lossFlex }}>
            <div className="sg-shaft dn" />
            <div className="sg-arrowhead dn">
              <svg viewBox="0 0 24 12"><polygon points="12,12 24,0 0,0" fill="currentColor"/></svg>
            </div>
          </div>
        </div>

        {/* right: ticker rows, matched by flex so rows align to their arrow */}
        <div className="sg-col-list">
          <div className="sg-sect gain" style={{ flex: gainFlex }}>
            {gains.map(s => (
              <div key={s.t} className={"sg-tickrow up " + (s.flash ? "flash" : "")}>
                <span className="sg-t mono">{s.t}</span>
                <span className="sg-pct mono">+{Math.round(s.chg)}%</span>
              </div>
            ))}
          </div>
          <div className="sg-sect loss" style={{ flex: lossFlex }}>
            {losses.map(s => (
              <div key={s.t} className={"sg-tickrow dn " + (s.flash ? "flash" : "")}>
                <span className="sg-t mono">{s.t}</span>
                <span className="sg-pct mono">&minus;{Math.round(Math.abs(s.chg))}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sg-foot mono">{sorted.length} TICKERS</div>
    </div>
  );
}

export default StockGadget;
