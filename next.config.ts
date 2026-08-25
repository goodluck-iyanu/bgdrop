/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['172.20.10.2'],
  turbopack: {},
  // sharp & onnx must stay as native Node.js modules, not bundled
  serverExternalPackages: ['sharp', 'onnxruntime-node'],
};

module.exports = nextConfig;