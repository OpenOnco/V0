import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

// Update these counts periodically (or fetch from an API)
const STATS = {
  tests: '100+',
  vendors: '50+',
  free: '100%',
};

const CATEGORIES = [
  { name: 'Early Detection', color: '#3b82f6', bg: '#dbeafe' },
  { name: 'Genomic Profiling', color: '#10b981', bg: '#d1fae5' },
  { name: 'Treatment Response', color: '#f59e0b', bg: '#fef3c7' },
  { name: 'MRD Monitoring', color: '#8b5cf6', bg: '#ede9fe' },
];

export default function handler(req) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'home';
  const testName = searchParams.get('test');
  const vendor = searchParams.get('vendor');
  const category = searchParams.get('category');

  // Test-specific image
  if (type === 'test' && testName && vendor) {
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8fafc',
            padding: '60px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
            <div style={{ fontSize: 42, fontWeight: 'bold', color: '#0d9488' }}>
              OpenOnco
            </div>
          </div>
          <div style={{ fontSize: 56, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: '20px' }}>
            {testName}
          </div>
          <div style={{ fontSize: 32, color: '#64748b', marginBottom: '30px' }}>
            by {vendor}
          </div>
          <div
            style={{
              display: 'flex',
              padding: '12px 32px',
              backgroundColor: category === 'mrd' ? '#ede9fe' : 
                             category === 'ecd' ? '#dbeafe' : 
                             category === 'trm' ? '#fef3c7' : '#d1fae5',
              borderRadius: '999px',
              fontSize: 24,
              color: category === 'mrd' ? '#8b5cf6' : 
                     category === 'ecd' ? '#3b82f6' : 
                     category === 'trm' ? '#f59e0b' : '#10b981',
              fontWeight: '600',
            }}
          >
            {category?.toUpperCase() || 'TEST'}
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  // Category page image
  if (type === 'category' && category) {
    const catInfo = {
      mrd: { name: 'MRD Monitoring', color: '#8b5cf6', bg: '#ede9fe', desc: 'Minimal Residual Disease Tests' },
      ecd: { name: 'Early Detection', color: '#3b82f6', bg: '#dbeafe', desc: 'Cancer Screening Tests' },
      trm: { name: 'Treatment Response', color: '#f59e0b', bg: '#fef3c7', desc: 'Therapy Monitoring Tests' },
      tds: { name: 'Genomic Profiling', color: '#10b981', bg: '#d1fae5', desc: 'Comprehensive Genomic Panels' },
      cgp: { name: 'Genomic Profiling', color: '#10b981', bg: '#d1fae5', desc: 'Comprehensive Genomic Panels' },
    }[category?.toLowerCase()] || { name: category, color: '#64748b', bg: '#f1f5f9', desc: '' };

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8fafc',
            padding: '60px',
          }}
        >
          <div style={{ fontSize: 42, fontWeight: 'bold', color: '#0d9488', marginBottom: '40px' }}>
            OpenOnco
          </div>
          <div
            style={{
              display: 'flex',
              padding: '16px 48px',
              backgroundColor: catInfo.bg,
              borderRadius: '999px',
              fontSize: 48,
              color: catInfo.color,
              fontWeight: 'bold',
              marginBottom: '24px',
            }}
          >
            {catInfo.name}
          </div>
          <div style={{ fontSize: 32, color: '#64748b' }}>
            {catInfo.desc}
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  // Default: Homepage image with stats
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          padding: '50px',
        }}
      >
        {/* Logo and title */}
        <div style={{ fontSize: 64, fontWeight: 'bold', color: '#0d9488', marginBottom: '8px' }}>
          OpenOnco
        </div>
        <div style={{ fontSize: 28, color: '#64748b', marginBottom: '50px' }}>
          Cancer Tests—Collected, Curated, Explained
        </div>

        {/* Category badges */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '50px' }}>
          {CATEGORIES.map((cat) => (
            <div
              key={cat.name}
              style={{
                display: 'flex',
                padding: '10px 20px',
                backgroundColor: cat.bg,
                borderRadius: '999px',
                fontSize: 18,
                color: cat.color,
                fontWeight: '600',
              }}
            >
              {cat.name}
            </div>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '80px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 56, fontWeight: 'bold', color: '#0d9488' }}>{STATS.tests}</div>
            <div style={{ fontSize: 20, color: '#64748b' }}>Tests Compared</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 56, fontWeight: 'bold', color: '#0d9488' }}>{STATS.vendors}</div>
            <div style={{ fontSize: 20, color: '#64748b' }}>Vendors</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 56, fontWeight: 'bold', color: '#10b981' }}>{STATS.free}</div>
            <div style={{ fontSize: 20, color: '#64748b' }}>Free & Open</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ fontSize: 18, color: '#94a3b8', marginTop: '50px' }}>
          openonco.org • Vendor-neutral liquid biopsy test comparison
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
