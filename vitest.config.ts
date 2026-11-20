import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

process.env.TZ = "Asia/Ho_Chi_Minh";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": src("./src"),
      "server-only": src("./src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    restoreMocks: true,
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts", "db/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "**/*.db.test.ts"],
  },
});
