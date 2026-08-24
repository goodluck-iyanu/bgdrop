'use client';

import { useState } from "react";

export default function Home() {
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Helper to shrink large phone photos down to max 1024px instantly before AI processing
  const resizeImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Image processing failed'));
          }, 'image/jpeg', 0.9);
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResultImage(null);
    setErrorMsg("");
    setLoading(true);

    try {
      // 1. Instantly shrink the image so the AI has 10x fewer pixels to process
      const optimizedBlob = await resizeImage(file);

      // @ts-ignore
      const imgly = await import("@imgly/background-removal");
      const removeBackground = imgly.default || imgly.removeBackground || imgly;

      if (typeof removeBackground !== "function") {
        throw new Error("Background removal module failed to load.");
      }

      // 2. Run lightning-fast background removal on the optimized image
      const blob = await removeBackground(optimizedBlob, {
        model: "isnet_quint8",
        device: "gpu",
      });

      setResultImage(URL.createObjectURL(blob));
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to process image. Please try again.");
    }
    setLoading(false);
  };

  const handleReset = () => {
    setResultImage(null);
    setErrorMsg("");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", backgroundColor: '#FFFFFF', color: '#000000', lineHeight: 1.6 }}>
      
      {/* Navigation */}
      <nav style={{ backgroundColor: '#000000', color: '#FFFFFF', padding: '20px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <a href="/" style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', fontWeight: 700, textDecoration: 'none', color: '#FFFFFF' }}>
            Drop<span style={{ color: '#C8001A' }}>BG</span>
          </a>
          <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
            <a href="https://hoberg.com.ng/tools/" style={{ fontSize: '15px', fontWeight: 500, color: '#FFFFFF', textDecoration: 'none' }}>All Tools</a>
            <a href="https://hoberg.com.ng/" style={{ background: '#FFFFFF', color: '#000000', padding: '8px 16px', borderRadius: '4px', fontWeight: 700, fontSize: '14px', textDecoration: 'none' }}>Agency</a>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main style={{ flex: '1 0 auto' }}>
        <header style={{ backgroundColor: '#000000', color: '#FFFFFF', padding: '80px 0 100px', textAlign: 'center' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
            
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '100px', fontSize: '13px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#C8001A"><path d="M12 2L2 22h20L12 2z"/></svg>
              <span>Built by <a href="https://hoberg.com.ng/tools/" style={{ fontWeight: 700, color: '#FFFFFF', textDecoration: 'underline' }}>Hoberg Tools</a>. Powered by <a href="https://hoberg.com.ng/" style={{ fontWeight: 700, color: '#FFFFFF', textDecoration: 'underline' }}>Hoberg Digital</a>.</span>
            </div>
            
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(36px, 5vw, 56px)', marginBottom: '16px', fontWeight: 700 }}>Remove Image Backgrounds</h1>
            <p style={{ color: '#888888', fontSize: '18px', maxWidth: '650px', margin: '0 auto 40px' }}>Upload any image to strip the background instantly and completely free. Processed securely in your browser.</p>
            
            {/* Upload Box Container */}
            {!resultImage && !loading && (
              <label style={{ maxWidth: '750px', margin: '0 auto', background: '#FFFFFF', padding: '40px 32px', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '2px dashed #D0D0D0', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '40px', color: '#C8001A', marginBottom: '8px' }}>📁</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#000000' }}>Click to upload an image</div>
                <div style={{ fontSize: '14px', color: '#888888' }}>Supports PNG, JPG, JPEG (Processed locally)</div>
                <input type="file" style={{ display: 'none' }} accept="image/*" onChange={handleFileChange} />
              </label>
            )}

            {/* Loading Spinner State */}
            {loading && (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{ width: '36px', height: '36px', border: '4px solid rgba(200,0,26,0.2)', borderRadius: '50%', borderTopColor: '#C8001A', animation: 'spin 1s ease-in-out infinite', margin: '0 auto 16px' }} />
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', color: '#FFFFFF', marginBottom: '8px' }}>Removing Background...</h3>
                <p style={{ color: '#888888', fontSize: '14px' }}>Blazing fast local AI processing in progress...</p>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div style={{ marginTop: '16px', color: '#ff4d4d', fontSize: '14px' }}>
                {errorMsg}
              </div>
            )}

            {/* Result Card */}
            {resultImage && (
              <div style={{ background: '#FFFFFF', borderRadius: '8px', maxWidth: '750px', margin: '24px auto 0', padding: '24px', textAlign: 'left', color: '#000000', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                <div style={{ width: '100%', maxHeight: '350px', background: 'repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%)', backgroundSize: '20px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', marginBottom: '24px', overflow: 'hidden' }}>
                  <img src={resultImage} alt="Background Removed" style={{ maxHeight: '300px', objectFit: 'contain' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button onClick={handleReset} style={{ background: 'transparent', border: '2px solid #000000', color: '#000000', padding: '16px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
                    Upload Another
                  </button>
                  <a href={resultImage} download="dropbg-transparent.png" style={{ background: '#C8001A', color: '#FFFFFF', border: 'none', padding: '16px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>
                    Download (No Background)
                  </a>
                </div>
              </div>
            )}

          </div>
        </header>

        {/* Hoberg Tools Ecosystem Section */}
        <section style={{ backgroundColor: '#F5EFE6', padding: '80px 0' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
            <div style={{ textAlign: 'center', marginBottom: '56px' }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(28px, 4vw, 40px)', marginBottom: '16px', fontWeight: 700, color: '#000000' }}>More free tools from Hoberg</h2>
              <p style={{ color: '#888888', fontSize: '18px', maxWidth: '600px', margin: '0 auto' }}>Explore other utility software built by Hoberg Digital Agency to make your digital workflows easier.</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <a href="https://tikdrop.hoberg.com.ng" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', width: '100%', maxWidth: '360px' }}>
                <div style={{ background: '#FFFFFF', padding: '32px 24px', border: '1px solid #E5E5E5', borderRadius: '8px', position: 'relative', transition: 'all 0.2s ease', boxShadow: '0 10px 20px rgba(0,0,0,0.02)' }}>
                  <span style={{ position: 'absolute', top: '24px', right: '24px', fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#C8001A', color: '#FFFFFF' }}>Live</span>
                  <div style={{ fontSize: '32px', marginBottom: '20px' }}>🎵</div>
                  <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: '#000000' }}>TikDrop</h3>
                  <p style={{ color: '#888888', fontSize: '15px', lineHeight: 1.5 }}>TikTok video downloader — no watermark, HD quality MP4s.</p>
                </div>
              </a>
            </div>
          </div>
        </section>

        {/* Hoberg Agency CTA */}
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
                Drop<span style={{ color: '#C8001A' }}>BG</span>
              </a>
              <p style={{ color: '#888888', fontSize: '15px', maxWidth: '350px' }}>DropBG is a free utility platform built, maintained, and secured by Hoberg Digital Agency, operating under the Hoberg Tools ecosystem.</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center' }}>
            <p style={{ color: '#888888', fontSize: '13px' }}>&copy; 2026 DropBG. Powered by Hoberg Digital Agency.</p>
            <p style={{ color: '#000000', fontSize: '13px', fontWeight: 700 }}>Secure Local Browser Processing</p>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        html, body {
          overflow-x: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        html::-webkit-scrollbar, body::-webkit-scrollbar {
          display: none;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}