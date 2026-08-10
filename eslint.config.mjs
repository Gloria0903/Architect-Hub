import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "uploads/**",
      "prisma/migrations/**",
    ],
  },
];

export default eslintConfig;
