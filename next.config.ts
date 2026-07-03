import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["jwks-rsa", "jose"],
  turbopack: {},
};

export default nextConfig;
