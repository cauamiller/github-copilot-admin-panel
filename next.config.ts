import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // build no PC, runtime copiado para o Android (armv7l, sem SWC nativo)
  output: "standalone",
};

export default nextConfig;
