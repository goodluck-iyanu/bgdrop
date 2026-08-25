/**
 * Web Worker for blazing-fast background removal using Transformers.js
 * Runs off the main thread so the UI never freezes.
 * Model is pre-warmed on worker start so processing is instant when user uploads.
 */

import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/dist/transformers.min.js";

// Use hosted WASM/ONNX runtime from CDN — no bundle needed
env.allowLocalModels = false;
env.backends.onnx.wasm.proxy = false;

let segmenter = null;

// Pre-warm: load model immediately when worker starts
async function loadModel() {
  try {
    segmenter = await pipeline("image-segmentation", "briaai/RMBG-1.4", {
      device: "webgpu",
    });
  } catch {
    // WebGPU not available — fall back to WASM (still fast)
    segmenter = await pipeline("image-segmentation", "briaai/RMBG-1.4", {
      device: "wasm",
    });
  }
  self.postMessage({ type: "ready" });
}

loadModel().catch((err) => {
  self.postMessage({ type: "error", message: err.message });
});

self.addEventListener("message", async (e) => {
  const { type, imageData, width, height } = e.data;

  if (type !== "process") return;

  if (!segmenter) {
    self.postMessage({ type: "error", message: "Model not loaded yet." });
    return;
  }

  try {
    // imageData is a Uint8ClampedArray (RGBA from canvas)
    // Convert to a canvas ImageData blob the pipeline can accept
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    const imgDataObj = new ImageData(imageData, width, height);
    ctx.putImageData(imgDataObj, 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    const url = URL.createObjectURL(blob);

    const result = await segmenter(url, { subtask: "instance" });
    URL.revokeObjectURL(url);

    // result[0].mask is the foreground mask
    const mask = result[0].mask;

    // Apply mask to original RGBA data
    const output = new Uint8ClampedArray(imageData.length);
    for (let i = 0; i < width * height; i++) {
      output[i * 4]     = imageData[i * 4];
      output[i * 4 + 1] = imageData[i * 4 + 1];
      output[i * 4 + 2] = imageData[i * 4 + 2];
      output[i * 4 + 3] = Math.round(mask.data[i] * 255);
    }

    self.postMessage({ type: "result", output, width, height }, [output.buffer]);
  } catch (err) {
    self.postMessage({ type: "error", message: err.message });
  }
});

