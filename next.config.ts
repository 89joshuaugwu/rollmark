import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["jwks-rsa", "jose", "firebase-admin"],
};

export default nextConfig;
