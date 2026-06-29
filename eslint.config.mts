import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
  globalIgnores([
    "**/node_modules/**",
    "dist/**",
    "**/main.js",
    "**/esbuild.config.mjs",
    "scripts/**"
  ]),
  {
    languageOptions: {
      globals: {
        ...globals.browser
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mts"]
        },
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  ...obsidianmd.configs.recommended
);
