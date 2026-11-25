import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The claims gate runs separately: npm run test:claims (vitest.claims.config.mts).
    exclude: [...configDefaults.exclude, "tests/claims/**"],
  },
});
