import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/dashboard": ["./data/demo.json"],
  },
};
export default config;
