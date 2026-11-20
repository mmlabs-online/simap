import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

process.env.TZ = "Asia/Ho_Chi_Minh";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// DB integration tests only (`pnpm test:db`); `pnpm test` excludes `*.db.test.ts`.
export default defineConfig({
  resolve: {
    alias: {
      "@": src("./src"),
      "server-only": src("./src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    globalSetup: ["src/test/db/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 60000,
  },
});
