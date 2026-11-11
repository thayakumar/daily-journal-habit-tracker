import { build } from "vite";
await build({
  define: {
    "import.meta.env.VITE_GOOGLE_SCRIPT_URL": "globalThis.__TEST_SCRIPT_URL__",
  },
  build: {
    ssr: "tests/components.ts",
    outDir: "work/test-build",
    emptyOutDir: true,
  },
  logLevel: "warn",
});
