import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

// Category colors matching the site
const CATEGORY_COLORS = {
  ecd: '#3B82F6', // blue
  tds: '#10B981', // emerald
  trm: '#F59E0B', // amber
  mrd: '#8B5CF6', // purple
};

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'home'; // home, category, test
  const category = searchParams.get('category');
  const testName = searchParams.get('test');
  const vendor = searchParams.get('vendor');
  
  // Dynamic counts - will update as database grows
  const testCount = searchParams.get('tests') || '100+';
  const vendorCount = searchParams.get('vendors') || '50+';

  if (type === 'home') {
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#f8fafc',
            padding: '60px',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
            <div
              style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: '#0d9488',
                display: 'flex',
              }}
            >
              OpenOnco
            </div>
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: '56px',
              fontWeight: 'bold',
              color: '#1e293b',
              marginBottom: '30px',
              lineHeight: 1.2,
              display: 'flex',
            }}
          >
            Cancer Tests—Collected, Curated, Explained
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '60px', marginTop: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '64px', fontWeight: 'bold', color: '#0d9488', display: 'flex' }}>
                {testCount}
              </div>
              <div style={{ fontSize: '24px', color: '#64748b', display: 'flex' }}>Tests Compared</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '64px', fontWeight: 'bold', color: '#0d9488', display: 'flex' }}>
                {vendorCount}
              </div>
              <div style={{ fontSize: '24px', color: '#64748b', display: 'flex' }}>Vendors</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '64px', fontWeight: 'bold', color: '#0d9488', display: 'flex' }}>
                100%
              </div>
              <div style={{ fontSize: '24px', color: '#64748b', display: 'flex' }}>Free & Open</div>
            </div>
          </div>

          {/* Category badges */}
          <div style={{ display: 'flex', gap: '20px', marginTop: '50px' }}>
            <div
              style={{
                backgroundColor: CATEGORY_COLORS.ecd,
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '20px',
                fontWeight: '600',
                display: 'flex',
              }}
            >
              Early Detection
            </div>
            <div
              style={{
                backgroundColor: CATEGORY_COLORS.tds,
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '20px',
                fontWeight: '600',
                display: 'flex',
              }}
            >
              Genomic Profiling
            </div>
            <div
              style={{
                backgroundColor: CATEGORY_COLORS.trm,
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '20px',
                fontWeight: '600',
                display: 'flex',
              }}
            >
              Treatment Response
            </div>
            <div
              style={{
                backgroundColor: CATEGORY_COLORS.mrd,
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '20px',
                fontWeight: '600',
                display: 'flex',
              }}
            >
              MRD Monitoring
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              right: '60px',
              fontSize: '24px',
              color: '#94a3b8',
              display: 'flex',
            }}
          >
            openonco.org
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  }

  // Category page
  if (type === 'category' && category) {
    const categoryNames = {
      ecd: 'Early Cancer Detection',
      tds: 'Treatment Decision Support',
      trm: 'Treatment Response Monitoring',
      mrd: 'MRD Monitoring',
    };

    const categoryDescs = {
      ecd: 'Compare screening and early detection tests including Galleri, Shield, and multi-cancer detection assays.',
      tds: 'Compare comprehensive genomic profiling panels for identifying targetable mutations.',
      trm: 'Compare treatment response monitoring tests to track therapy effectiveness.',
      mrd: 'Compare Minimal Residual Disease tests for cancer recurrence monitoring.',
    };

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#f8fafc',
            padding: '60px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px' }}>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#0d9488', display: 'flex' }}>
              OpenOnco
            </div>
          </div>

          <div
            style={{
              backgroundColor: CATEGORY_COLORS[category] || '#6366f1',
              color: 'white',
              padding: '16px 32px',
              borderRadius: '12px',
              fontSize: '24px',
              fontWeight: '600',
              display: 'flex',
              width: 'fit-content',
              marginBottom: '30px',
            }}
          >
            {category.toUpperCase()}
          </div>

          <div
            style={{
              fontSize: '56px',
              fontWeight: 'bold',
              color: '#1e293b',
              marginBottom: '24px',
              display: 'flex',
            }}
          >
            {categoryNames[category] || 'Cancer Tests'}
          </div>

          <div
            style={{
              fontSize: '28px',
              color: '#64748b',
              lineHeight: 1.4,
              display: 'flex',
            }}
          >
            {categoryDescs[category] || 'Compare cancer diagnostic tests.'}
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              right: '60px',
              fontSize: '24px',
              color: '#94a3b8',
              display: 'flex',
            }}
          >
            openonco.org
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  }

  // Test page
  if (type === 'test' && testName) {
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#f8fafc',
            padding: '60px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px' }}>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#0d9488', display: 'flex' }}>
              OpenOnco
            </div>
          </div>

          {category && (
            <div
              style={{
                backgroundColor: CATEGORY_COLORS[category] || '#6366f1',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '20px',
                fontWeight: '600',
                display: 'flex',
                width: 'fit-content',
                marginBottom: '24px',
              }}
            >
              {category.toUpperCase()}
            </div>
          )}

          <div
            style={{
              fontSize: '64px',
              fontWeight: 'bold',
              color: '#1e293b',
              marginBottom: '16px',
              display: 'flex',
            }}
          >
            {testName}
          </div>

          {vendor && (
            <div
              style={{
                fontSize: '32px',
                color: '#64748b',
                display: 'flex',
              }}
            >
              by {vendor}
            </div>
          )}

          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              right: '60px',
              fontSize: '24px',
              color: '#94a3b8',
              display: 'flex',
            }}
          >
            openonco.org
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  }

  // Default fallback
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0d9488',
        }}
      >
        <div style={{ fontSize: '64px', fontWeight: 'bold', color: 'white', display: 'flex' }}>
          OpenOnco
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
