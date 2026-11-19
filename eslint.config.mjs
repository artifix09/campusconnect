import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", "node_modules/**", "docs/**", "scripts/**", "coverage/**", "next-env.d.ts"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "Rendering raw HTML is not allowed (XSS risk). See docs/05 section 6.",
        },
      ],
    },
  },
  {
    // The domain layer stays pure: no framework, database or network code.
    files: ["src/domain/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["next", "next/*", "@/lib/db", "@/modules/*"], message: "Keep the domain layer pure." },
            { group: ["@prisma/client"], allowTypeImports: true, message: "Only type imports from Prisma here." },
          ],
        },
      ],
    },
  },
  {
    // Route handlers call services; only services and repositories touch the database.
    files: ["src/app/**/*.ts", "src/app/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [{ name: "@/lib/db", message: "Call a service from src/modules instead." }],
          patterns: [{ group: ["@prisma/client"], message: "Call a service from src/modules instead." }],
        },
      ],
    },
  },
];

export default config;
