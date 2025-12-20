const typescriptParser = require("@typescript-eslint/parser");
const typescriptPlugin = require("@typescript-eslint/eslint-plugin");
const prettierPlugin = require("eslint-plugin-prettier");
const prettierConfig = require("eslint-config-prettier");

module.exports = [
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parser: typescriptParser,
            ecmaVersion: 2020,
            sourceType: "module",
        },
        plugins: {
            "@typescript-eslint": typescriptPlugin,
            prettier: prettierPlugin,
        },
        rules: {
            "no-console": "warn",
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "@typescript-eslint/no-explicit-any": "warn",
            "prettier/prettier": "error",
        },
        ignores: ["out/**", "dist/**", "node_modules/**", "**/*.d.ts", "client/out/**", "server/out/**"],
    },
    prettierConfig,
];
