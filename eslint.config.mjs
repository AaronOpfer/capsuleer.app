import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintReact from "@eslint-react/eslint-plugin";
import prettier from "eslint-config-prettier";
import { defineConfig } from "eslint/config";

export default defineConfig([{
    files: ["src/**/*.{ts,tsx}"],

    extends: [
        js.configs.recommended,
        tseslint.configs.recommended,
        eslintReact.configs["recommended-typescript"],
        prettier,
    ],

    languageOptions: {
        globals: {
            ...globals.browser,
        },

        parser: tseslint.parser,
        parserOptions: {
            projectService: true,
            tsconfigRootDir: import.meta.dirname,
        },
    },
}]);
