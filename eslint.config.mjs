import typescriptEslint from "@typescript-eslint/eslint-plugin";
import unicorn from "eslint-plugin-unicorn";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: ["**/*.config.*", "**/examples", "**/dist"],
  },
  ...compat.extends(
    "eslint:recommended",
    "plugin:unicorn/recommended",
    "plugin:@typescript-eslint/recommended"
  ),
  {
    plugins: {
      "@typescript-eslint": typescriptEslint,
      unicorn,
    },

    languageOptions: {
      globals: {},
      ecmaVersion: 5,
      sourceType: "script",

      parserOptions: {
        project: "./tsconfig.json",
      },
    },

    rules: {
      "no-console": [
        "error",
        {
          allow: ["warn", "error"],
        },
      ],

      "@typescript-eslint/no-magic-numbers": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/prefer-as-const": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
        },
      ],

      "@typescript-eslint/prefer-ts-expect-error": "off",

      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: false,
        },
      ],

      "unicorn/prevent-abbreviations": "off",

      "no-implicit-coercion": [
        "error",
        {
          boolean: true,
        },
      ],

      "no-extra-boolean-cast": [
        "error",
        {
          enforceForLogicalOperands: true,
        },
      ],

      "no-unneeded-ternary": [
        "error",
        {
          defaultAssignment: true,
        },
      ],

      "unicorn/no-array-reduce": ["off"],
      "unicorn/no-nested-ternary": "off",
      "unicorn/no-null": "off",
      "unicorn/filename-case": "off",
    },
  },
];
