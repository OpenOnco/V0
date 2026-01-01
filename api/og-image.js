import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

export default function handler(req) {
  try {
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
            backgroundImage: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
          }}
        >
          {/* Logo */}
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, marginBottom: 10 }}>
            <span style={{ color: '#1e293b' }}>Open</span>
            <span style={{ color: '#10b981' }}>Onco</span>
          </div>
          
          {/* Tagline */}
          <div style={{ fontSize: 28, color: '#475569', marginBottom: 40 }}>
            Cancer Tests—Collected, Curated, Explained
          </div>
          
          {/* Badges */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 40 }}>
            <div style={{ padding: '12px 24px', borderRadius: 50, backgroundColor: '#22c55e', color: 'white', fontSize: 18, fontWeight: 600 }}>
              Early Detection
            </div>
            <div style={{ padding: '12px 24px', borderRadius: 50, backgroundColor: '#a855f7', color: 'white', fontSize: 18, fontWeight: 600 }}>
              Genomic Profiling
            </div>
            <div style={{ padding: '12px 24px', borderRadius: 50, backgroundColor: '#3b82f6', color: 'white', fontSize: 18, fontWeight: 600 }}>
              Treatment Response
            </div>
            <div style={{ padding: '12px 24px', borderRadius: 50, backgroundColor: '#f97316', color: 'white', fontSize: 18, fontWeight: 600 }}>
              MRD Monitoring
            </div>
          </div>
          
          {/* Stats */}
          <div style={{ display: 'flex', gap: 100 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 80, fontWeight: 700, color: '#10b981' }}>100+</div>
              <div style={{ fontSize: 20, color: '#64748b' }}>Tests Compared</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 80, fontWeight: 700, color: '#3b82f6' }}>50+</div>
              <div style={{ fontSize: 20, color: '#64748b' }}>Vendors</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 80, fontWeight: 700, color: '#f97316' }}>100%</div>
              <div style={{ fontSize: 20, color: '#64748b' }}>Free & Open</div>
            </div>
          </div>
          
          {/* Footer */}
          <div style={{ position: 'absolute', bottom: 30, fontSize: 18, color: '#64748b', display: 'flex' }}>
            <span style={{ fontWeight: 700, color: '#1e293b' }}>openonco.org</span>
            <span style={{ marginLeft: 8 }}>· Vendor-neutral liquid biopsy test comparison</span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e) {
    console.error('OG Image generation failed:', e);
    return new Response('Failed to generate image', { status: 500 });
  }
}
