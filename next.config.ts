import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["jwks-rsa", "jose", "firebase-admin"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ensure jose and jwks-rsa are treated as external dependencies
      // to avoid bundling ESM-only code into CommonJS context
      if (!config.externals) config.externals = [];
      config.externals.push(
        "jose",
        "jwks-rsa",
        "firebase-admin"
      );
    }
    return config;
  },
};

export default nextConfig;
