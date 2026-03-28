import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    if (process.env.NODE_ENV !== "development") {
      return [];
    }

    return [
      {
        source: "/api/python_analyze",
        destination:
          process.env.PYTHON_ANALYZE_URL?.trim() ||
          "http://127.0.0.1:8000/api/python_analyze",
      },
    ];
  },
};

export default nextConfig;
