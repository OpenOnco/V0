// Non-edge version - generate simple SVG
export default function handler(req, res) {
  const svg = `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f8fafc"/>
      <text x="600" y="200" font-family="system-ui, sans-serif" font-size="72" font-weight="bold" fill="#0d9488" text-anchor="middle">OpenOnco</text>
      <text x="600" y="260" font-family="system-ui, sans-serif" font-size="32" fill="#64748b" text-anchor="middle">Cancer Tests—Collected, Curated, Explained</text>
      <text x="300" y="400" font-family="system-ui, sans-serif" font-size="64" font-weight="bold" fill="#0d9488" text-anchor="middle">100+</text>
      <text x="300" y="450" font-family="system-ui, sans-serif" font-size="24" fill="#64748b" text-anchor="middle">Tests Compared</text>
      <text x="600" y="400" font-family="system-ui, sans-serif" font-size="64" font-weight="bold" fill="#0d9488" text-anchor="middle">50+</text>
      <text x="600" y="450" font-family="system-ui, sans-serif" font-size="24" fill="#64748b" text-anchor="middle">Vendors</text>
      <text x="900" y="400" font-family="system-ui, sans-serif" font-size="64" font-weight="bold" fill="#10b981" text-anchor="middle">100%</text>
      <text x="900" y="450" font-family="system-ui, sans-serif" font-size="24" fill="#64748b" text-anchor="middle">Free & Open</text>
      <text x="600" y="560" font-family="system-ui, sans-serif" font-size="18" fill="#94a3b8" text-anchor="middle">openonco.org • Vendor-neutral liquid biopsy test comparison</text>
    </svg>
  `;
  
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(svg.trim());
}
