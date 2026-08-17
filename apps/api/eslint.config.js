import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import {defineConfig} from "eslint/config"

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["**/api/*.{js,ts}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  {
    ignores: ["**/dist/**", "**/build/**", "**/coverage/**", "**/node_modules/**"],
  },

  // Must be last
  eslintConfigPrettier,
]);
