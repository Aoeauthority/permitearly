import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stripe webhook needs raw body
  api: {
    bodyParser: false,
  },
};

export default nextConfig;
