import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

export default function handler() {
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
        }}
      >
        <div style={{ fontSize: 60, fontWeight: 'bold', color: '#0d9488' }}>
          OpenOnco
        </div>
        <div style={{ fontSize: 30, color: '#64748b', marginTop: 20 }}>
          100+ Cancer Tests Compared
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
