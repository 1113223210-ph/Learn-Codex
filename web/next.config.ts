import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "export",   // 静态导出，适配 Cloudflare Pages
  trailingSlash: true,
  // OpenClaw 容器配置
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      poll: 1000,
      aggregateTimeout: 300,
    };
    return config;
  },
};
export default nextConfig;
