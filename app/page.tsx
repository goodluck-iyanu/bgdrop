'use client';

import { useState, useRef } from 'react';

// ─── Resize image to max 1024px before uploading to API ──────────────────────
function resizeImage(file: File, maxSize = 1024): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))),
          'image/jpeg',
          0.92
        );
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Server-side route (fast — no browser model download) ────────────────────
async function removeViaServer(blob: Blob): Promise<string> {
  const fd = new FormData();
  fd.append('image', blob, 'image.jpg');
  const res = await fetch('/api/remove-bg', { method: 'POST', body: fd });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Server error' }));
    throw new Error(error ?? 'Server error');
  }
  const resultBlob = await res.blob();
  return URL.createObjectURL(resultBlob);
}

// ─── Client-side fallback (uses cached ONNX model in browser) ────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _removeBgFn: ((src: any, opts?: any) => Promise<Blob>) | null = null;
async function removeViaClient(blob: Blob): Promise<string> {
  if (!_removeBgFn) {
    // @ts-ignore
    const m = await import('@imgly/background-removal');
    const fn = m.default ?? m.removeBackground ?? m;
    if (typeof fn !== 'function') throw new Error('BG removal module failed to load');
    _removeBgFn = fn;
  }
  const result = await _removeBgFn!(blob, { model: 'isnet_quint8', device: 'gpu' });
  return URL.createObjectURL(result);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Home() {
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsed, setElapsed] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResultImage(null);
    setErrorMsg('');
    setElapsed(null);
    setLoading(true);
    setStatus('Preparing image…');

    const start = performance.now();
    timerRef.current = setInterval(
      () => setElapsed(+(((performance.now() - start) / 1000).toFixed(1))),
      200
    );

    try {
      const blob = await resizeImage(file);

      // ── Try server route first (no browser model download needed) ────
      try {
        setStatus('Removing background…');
        const url = await removeViaServer(blob);
        clearInterval(timerRef.current!);
        setElapsed(+((performance.now() - start) / 1000).toFixed(1));
        setResultImage(url);
        setLoading(false);
        setStatus('');
        return;
      } catch (serverErr) {
        console.warn('Server route failed, trying client-side…', serverErr);
      }

      // ── Fall back to client-side (downloads ONNX model in browser) ───
      setStatus('Using local AI (loading model…)');
      const url = await removeViaClient(blob);
      clearInterval(timerRef.current!);
      setElapsed(+((performance.now() - start) / 1000).toFixed(1));
      setResultImage(url);
    } catch (err: unknown) {
      clearInterval(timerRef.current!);
      const msg = err instanceof Error ? err.message : 'Failed to process image.';
      console.error(err);
      setErrorMsg(msg);
    }

    setLoading(false);
    setStatus('');
  };

  const handleReset = () => {
    setResultImage(null);
    setErrorMsg('');
    setElapsed(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", backgroundColor: '#FFFFFF', color: '#000000', lineHeight: 1.6 }}>

      {/* Navigation */}
      <nav style={{ backgroundColor: '#000000', color: '#FFFFFF', padding: '20px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <a href="/" style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', fontWeight: 700, textDecoration: 'none', color: '#FFFFFF' }}>
            BG <span style={{ color: '#C8001A' }}>Drop</span>
          </a>
          <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
            <a href="https://hoberg.com.ng/tools/" style={{ fontSize: '15px', fontWeight: 500, color: '#FFFFFF', textDecoration: 'none' }}>All Tools</a>
            <a href="https://hoberg.com.ng/" style={{ background: '#FFFFFF', color: '#000000', padding: '8px 16px', borderRadius: '4px', fontWeight: 700, fontSize: '14px', textDecoration: 'none' }}>Agency</a>
          </div>
        </div>
      </nav>

      {/* Main */}
      <main style={{ flex: '1 0 auto' }}>
        <header style={{ backgroundColor: '#000000', color: '#FFFFFF', padding: '80px 0 100px', textAlign: 'center' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '100px', fontSize: '13px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#C8001A"><path d="M12 2L2 22h20L12 2z" /></svg>
              <span>Built by <a href="https://hoberg.com.ng/tools/" style={{ fontWeight: 700, color: '#FFFFFF', textDecoration: 'underline' }}>Hoberg Tools</a>. Powered by <a href="https://hoberg.com.ng/" style={{ fontWeight: 700, color: '#FFFFFF', textDecoration: 'underline' }}>Hoberg Digital</a>.</span>
            </div>

            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(36px, 5vw, 56px)', marginBottom: '16px', fontWeight: 700 }}>BG Remover &amp; Background Drop</h1>
            <p style={{ color: '#888888', fontSize: '18px', maxWidth: '650px', margin: '0 auto 40px' }}>Upload any image to strip the background instantly and completely free. Super fast browser processing.</p>

            {/* Upload Box */}
            {!resultImage && !loading && (
              <label style={{ maxWidth: '750px', margin: '0 auto', background: '#FFFFFF', padding: '40px 32px', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '2px dashed #D0D0D0', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '40px', color: '#C8001A', marginBottom: '8px' }}>📁</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#000000' }}>Click to upload an image</div>
                <div style={{ fontSize: '14px', color: '#888888' }}>Supports PNG, JPG, JPEG · Processed locally</div>
                <input type="file" style={{ display: 'none' }} accept="image/*" onChange={handleFileChange} />
              </label>
            )}

            {/* Loading */}
            {loading && (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{ width: '36px', height: '36px', border: '4px solid rgba(200,0,26,0.2)', borderRadius: '50%', borderTopColor: '#C8001A', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} />
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', color: '#FFFFFF', marginBottom: '4px' }}>Removing Background…</h3>
                {status && <p style={{ color: '#aaaaaa', fontSize: '13px', margin: '4px 0' }}>{status}</p>}
                {elapsed !== null && elapsed > 0 && (
                  <p style={{ color: '#C8001A', fontSize: '14px', fontWeight: 700, margin: '4px 0' }}>{elapsed}s</p>
                )}
              </div>
            )}

            {/* Error */}
            {errorMsg && (
              <div style={{ marginTop: '16px', color: '#ff4d4d', fontSize: '14px' }}>{errorMsg}</div>
            )}

            {/* Result */}
            {resultImage && (
              <div style={{ background: '#FFFFFF', borderRadius: '8px', maxWidth: '750px', margin: '24px auto 0', padding: '24px', textAlign: 'left', color: '#000000', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                {elapsed !== null && (
                  <div style={{ textAlign: 'center', marginBottom: '12px', fontSize: '13px', color: '#22c55e', fontWeight: 700 }}>
                    ✓ Done in {elapsed}s
                  </div>
                )}
                <div style={{ width: '100%', maxHeight: '350px', background: 'repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%)', backgroundSize: '20px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', marginBottom: '24px', overflow: 'hidden' }}>
                  <img src={resultImage} alt="Background Removed" style={{ maxHeight: '300px', objectFit: 'contain' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button onClick={handleReset} style={{ background: 'transparent', border: '2px solid #000000', color: '#000000', padding: '16px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
                    Upload Another
                  </button>
                  <a href={resultImage} download="bgdrop-transparent.png" style={{ background: '#C8001A', color: '#FFFFFF', border: 'none', padding: '16px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                    Download (No Background)
                  </a>
                </div>
              </div>
            )}

          </div>
        </header>

        {/* More tools */}
        <section style={{ backgroundColor: '#F5EFE6', padding: '80px 0' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
            <div style={{ textAlign: 'center', marginBottom: '56px' }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(28px, 4vw, 40px)', marginBottom: '16px', fontWeight: 700, color: '#000000' }}>More free tools from Hoberg</h2>
              <p style={{ color: '#888888', fontSize: '18px', maxWidth: '600px', margin: '0 auto' }}>Explore other utility software built by Hoberg Digital Agency to make your digital workflows easier.</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <a href="https://tikdrop.hoberg.com.ng" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', width: '100%', maxWidth: '360px' }}>
                <div style={{ background: '#FFFFFF', padding: '32px 24px', border: '1px solid #E5E5E5', borderRadius: '8px', position: 'relative', boxShadow: '0 10px 20px rgba(0,0,0,0.02)' }}>
                  <span style={{ position: 'absolute', top: '24px', right: '24px', fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#C8001A', color: '#FFFFFF' }}>Live</span>
                  <div style={{ fontSize: '32px', marginBottom: '20px' }}>🎵</div>
                  <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: '#000000' }}>TikDrop</h3>
                  <p style={{ color: '#888888', fontSize: '15px', lineHeight: 1.5 }}>TikTok video downloader — no watermark, HD quality MP4s.</p>
                </div>
              </a>
            </div>
          </div>
        </section>

        {/* Agency CTA */}
        <section style={{ backgroundColor: '#000000', color: '#FFFFFF', textAlign: 'center', borderTop: '1px solid #222', padding: '80px 0' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(28px, 4vw, 40px)', marginBottom: '16px', fontWeight: 700 }}>Need more than a tool?</h2>
            <p style={{ color: '#888888', fontSize: '18px', maxWidth: '650px', margin: '0 auto 32px' }}>Hoberg Digital Agency builds entire digital experiences. We handle custom website development, brand identity, technical SEO, and paid advertising for Nigerian businesses.</p>
            <a href="https://hoberg.com.ng/" style={{ display: 'inline-block', background: '#FFFFFF', color: '#000000', padding: '16px 40px', borderRadius: '6px', fontWeight: 700, textDecoration: 'none' }}>Talk to Hoberg</a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ backgroundColor: '#F5F5F5', color: '#000000', padding: '80px 0 40px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '48px', borderBottom: '1px solid #E0E0E0', paddingBottom: '48px', marginBottom: '32px' }}>
            <div>
              <a href="/" style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', fontWeight: 700, textDecoration: 'none', color: '#000000', display: 'block', marginBottom: '16px' }}>
                BG <span style={{ color: '#C8001A' }}>Drop</span>
              </a>
              <p style={{ color: '#888888', fontSize: '15px', maxWidth: '350px' }}>BG Drop is a free utility platform built, maintained, and secured by Hoberg Digital Agency, operating under the Hoberg Tools ecosystem.</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center' }}>
            <p style={{ color: '#888888', fontSize: '13px' }}>&copy; 2026 BG Drop. Powered by Hoberg Digital Agency.</p>
            <p style={{ color: '#000000', fontSize: '13px', fontWeight: 700 }}>Secure Local Browser Processing</p>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        html, body { overflow-x: hidden; scrollbar-width: none; -ms-overflow-style: none; }
        html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}