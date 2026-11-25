import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The claims gate (npm run test:claims): each file checks one public claim
// about the project against real data. It fails until the data behind the
// claim exists; never weaken a threshold to make it pass.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/claims/**/*.test.ts"],
  },
});
