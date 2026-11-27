import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  distDir: process.env.SAVORA_PHASE88_TEST === "1" ? ".next-phase88" : ".next",
  async headers() {
    return [{
      source: "/savora-hero-mobile-v1.webp",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    }];
  },
  experimental: { cpus: 1 },
  turbopack: {
    root: process.cwd(),
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
