import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".next-*/**",
    "assets-private/**",
    "test-results/**",
    "public/pdf.worker.min.mjs",
  ]),
  {
    rules: {
      // Our effects load data from the server and reset local loading state at their start. React's own docs
      // accept this; the rule is advice on render cost, not a correctness check (ADR-015).
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
