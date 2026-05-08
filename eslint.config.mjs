import nextPlugin from "eslint-config-next";

const config = [
  ...nextPlugin,
  {
    ignores: [".next/**", "coverage/**", "reports/**", "node_modules/**"],
  },
];

export default config;
