import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingExcludes: { "/*": ["./data/demo.json"] },
  outputFileTracingIncludes: {
    "/*": [
      "./data/adventureworks2022.json",
      "./public/notices/microsoft-sql-server-samples.txt",
    ],
  },
};
export default config;
