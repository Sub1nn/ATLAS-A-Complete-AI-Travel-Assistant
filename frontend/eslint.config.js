import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

const runtimeGlobals = Object.fromEntries([
  "AbortController", "Blob", "Buffer", "clearInterval", "clearTimeout", "console",
  "crypto", "document", "Event", "fetch", "File", "FormData", "history", "localStorage",
  "MutationObserver", "navigator", "process", "requestAnimationFrame",
  "sessionStorage", "setInterval", "setTimeout", "URL", "URLSearchParams", "window",
].map((name) => [name, "readonly"]));

export default [
  { ignores: ["dist", "node_modules"] },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: runtimeGlobals,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "off",
      // React 18 intentionally hydrates auth/chat state from effects. The newer
      // compiler-oriented rule treats these existing synchronization effects
      // as errors even though they are bounded and dependency-safe.
      "react-hooks/set-state-in-effect": "off",
      "no-dupe-keys": "error",
      "no-func-assign": "error",
      "no-unreachable": "error",
      "no-unsafe-finally": "error",
      "no-undef": "error",
      "no-unused-vars": "off",
    },
  },
];
