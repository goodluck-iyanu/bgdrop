import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

const HF_MODEL_URL =
  'https://api-inference.huggingface.co/models/briaai/RMBG-1.4';

const MAX_SIZE = 1024;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());

    // ── 1. Resize server-side with sharp ─────────────────────────────────
    const meta = await sharp(rawBuffer).metadata();
    let w = meta.width ?? MAX_SIZE;
    let h = meta.height ?? MAX_SIZE;
    if (w > MAX_SIZE || h > MAX_SIZE) {
      const ratio = Math.min(MAX_SIZE / w, MAX_SIZE / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    const resizedPng = await sharp(rawBuffer).resize(w, h).png().toBuffer();

    // ── 2. Call Hugging Face Inference API ───────────────────────────────
    const headers: Record<string, string> = {
      'Content-Type': 'application/octet-stream',
    };
    const hfKey = process.env.HUGGINGFACE_API_KEY;
    if (hfKey) headers['Authorization'] = `Bearer ${hfKey}`;

    let hfRes = await fetch(HF_MODEL_URL, {
      method: 'POST',
      headers,
      body: resizedPng,
    });

    // If model is loading (503), wait up to 20s and retry once
    if (hfRes.status === 503) {
      await new Promise((r) => setTimeout(r, 8000));
      hfRes = await fetch(HF_MODEL_URL, {
        method: 'POST',
        headers,
        body: resizedPng,
      });
    }

    if (!hfRes.ok) {
      const text = await hfRes.text();
      return NextResponse.json(
        { error: `AI service error (${hfRes.status}): ${text}` },
        { status: 502 }
      );
    }

    const contentType = hfRes.headers.get('content-type') ?? '';

    // ── 3a. HF returns JSON (segmentation masks) ─────────────────────────
    if (contentType.includes('application/json')) {
      const data = await hfRes.json();
      // data = [{ label, score, mask: "base64 png" }, ...]
      // Find the foreground mask (highest score or label containing 'foreground')
      const maskEntry =
        data.find(
          (d: { label: string }) =>
            d.label?.toLowerCase().includes('foreground') ||
            d.label?.toLowerCase().includes('object')
        ) ?? data[0];

      if (!maskEntry?.mask) {
        return NextResponse.json(
          { error: 'No mask returned from AI' },
          { status: 502 }
        );
      }

      const maskBuffer = Buffer.from(maskEntry.mask, 'base64');
      const result = await applyMask(resizedPng, maskBuffer, w, h);
      return pngResponse(result);
    }

    // ── 3b. HF returns raw image (mask PNG) ──────────────────────────────
    const maskBuffer = Buffer.from(await hfRes.arrayBuffer());
    const result = await applyMask(resizedPng, maskBuffer, w, h);
    return pngResponse(result);
  } catch (err: unknown) {
    console.error('[remove-bg]', err);
    const message = err instanceof Error ? err.message : 'Processing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function applyMask(
  originalPng: Buffer,
  maskPng: Buffer,
  w: number,
  h: number
): Promise<Buffer> {
  // Extract mask as grayscale (single channel)
  const maskRaw = await sharp(maskPng)
    .resize(w, h)
    .grayscale()
    .raw()
    .toBuffer();

  // Extract original as RGBA
  const origRaw = await sharp(originalPng)
    .resize(w, h)
    .ensureAlpha()
    .raw()
    .toBuffer();

  // Apply mask as alpha channel
  const output = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    output[i * 4] = origRaw[i * 4];         // R
    output[i * 4 + 1] = origRaw[i * 4 + 1]; // G
    output[i * 4 + 2] = origRaw[i * 4 + 2]; // B
    output[i * 4 + 3] = maskRaw[i];          // A from mask
  }

  return sharp(output, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();
}

function pngResponse(buffer: Buffer) {
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
    },
  });
}
