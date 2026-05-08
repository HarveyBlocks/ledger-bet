import nextPlugin from "eslint-config-next";

const config = [
  ...nextPlugin,
  {
    ignores: [".next/**", "coverage/**", "node_modules/**"],
  },
];

export default config;
