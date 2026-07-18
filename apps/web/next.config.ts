import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Google アカウントのプロフィール画像（Firebase Auth の photoURL）
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
};

export default nextConfig;
