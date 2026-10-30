import reactHooks from "eslint-plugin-react-hooks";
import { baseConfig } from "./index.js";

export function reactConfig() {
  return [
    ...baseConfig(),
    {
      files: ["**/*.{ts,tsx}"],
      plugins: {
        "react-hooks": reactHooks,
      },
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  ];
}
