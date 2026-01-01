import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

// Update these counts periodically
const STATS = {
  tests: '100+',
  vendors: '50+',
};

export default function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'home';

    // Simple homepage image with stats
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
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div style={{ fontSize: 72, fontWeight: 'bold', color: '#0d9488' }}>
            OpenOnco
          </div>
          <div style={{ fontSize: 32, color: '#64748b', marginTop: 16, marginBottom: 48 }}>
            Cancer Tests—Collected, Curated, Explained
          </div>
          <div style={{ display: 'flex', gap: 60 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 64, fontWeight: 'bold', color: '#0d9488' }}>{STATS.tests}</div>
              <div style={{ fontSize: 24, color: '#64748b' }}>Tests Compared</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 64, fontWeight: 'bold', color: '#0d9488' }}>{STATS.vendors}</div>
              <div style={{ fontSize: 24, color: '#64748b' }}>Vendors</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 64, fontWeight: 'bold', color: '#10b981' }}>100%</div>
              <div style={{ fontSize: 24, color: '#64748b' }}>Free & Open</div>
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
