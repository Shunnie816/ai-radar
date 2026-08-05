import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'AI Radar'

// 日本語フォントを同梱していないため、画像内のテキストは英字のみにする
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #eef2ff 0%, #ffffff 60%)',
          color: '#1e1b4b',
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: '-0.03em' }}>AI Radar</div>
        <div style={{ marginTop: 24, fontSize: 40, color: '#4f46e5' }}>
          Daily AI news, collected and summarized
        </div>
      </div>
    ),
    size
  )
}
