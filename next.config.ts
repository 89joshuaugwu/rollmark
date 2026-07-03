import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["jwks-rsa", "jose"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        "jwks-rsa": "commonjs jwks-rsa",
      });
    }
    return config;
  },
};

export default nextConfig;
