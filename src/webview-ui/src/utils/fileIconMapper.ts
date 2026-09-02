/**
 * File Extension to Icon Mapper
 * Maps file extensions to SVG icon files in public/images/icon/
 */
import { DEFAULT_FOLDER, DEFAULT_FOLDER_OPENED } from "vscode-icons-js";

// ─── Extension → Icon Map ─────────────────────────────────────────────────
// Maps file extensions directly to our icon filenames (without .svg).
// Fallback: "file" for unknown types.
const EXT_ICON_MAP: Record<string, string> = {
  // JavaScript family
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "react",
  ts: "typescript",
  tsx: "react_ts",
  // Web
  html: "html",
  htm: "html",
  css: "css",
  scss: "sass",
  sass: "sass",
  less: "less",
  vue: "vue",
  svelte: "svelte",
  astro: "astro",
  // Data
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  xml: "xml",
  svg: "svg",
  toml: "toml",
  // Docs
  md: "markdown",
  mdx: "markdown",
  txt: "document",
  log: "log",
  // Scripts
  sh: "shellcheck",
  bash: "shellcheck",
  zsh: "shellcheck",
  fish: "shellcheck",
  ps1: "powershell",
  bat: "bat",
  cmd: "bat",
  // Backend
  py: "python",
  rb: "ruby",
  php: "php",
  java: "java",
  class: "javaclass",
  jar: "jar",
  go: "go",
  rs: "rust",
  swift: "swift",
  kt: "kotlin",
  dart: "dart",
  lua: "lua",
  r: "r",
  scala: "scala",
  clj: "clojure",
  cljs: "clojure",
  ex: "elixir",
  exs: "elixir",
  hs: "haskell",
  lhs: "haskell",
  // C family
  c: "c",
  h: "h",
  cpp: "cpp",
  hpp: "hpp",
  cc: "cpp",
  cxx: "cpp",
  cs: "csharp",
  // Config
  env: "settings",
  cfg: "settings",
  conf: "settings",
  ini: "settings",
  editorconfig: "editorconfig",
  gitignore: "git",
  gitattributes: "git",
  dockerfile: "docker",
  makefile: "makefile",
  license: "license",
  // Database
  sql: "database",
  prisma: "prisma",
  graphql: "graphql",
  gql: "graphql",
  // Other
  pdf: "pdf",
  zip: "zip",
  gz: "zip",
  tar: "zip",
  exe: "exe",
  dll: "dll",
  wasm: "webassembly",
  // Tests
  "test.js": "test-js",
  "test.jsx": "test-jsx",
  "test.ts": "test-ts",
  "test.tsx": "test-ts",
  spec: "test-js",
  // Lock files
  "package-lock.json": "npm",
  "yarn.lock": "yarn",
  "pnpm-lock.yaml": "pnpm",
  // Config files (exact match)
  "package.json": "npm",
  "tsconfig.json": "tsconfig",
  "jsconfig.json": "jsconfig",
  "eslint.config.js": "eslint",
  "eslint.config.mjs": "eslint",
  ".eslintrc": "eslint",
  ".eslintrc.json": "eslint",
  ".prettierrc": "prettier",
  "vite.config.ts": "vite",
  "vite.config.js": "vite",
  "webpack.config.js": "webpack",
  "webpack.config.ts": "webpack",
  "tailwind.config.js": "tailwindcss",
  "tailwind.config.ts": "tailwindcss",
  "postcss.config.js": "postcss",
  "postcss.config.mjs": "postcss",
  "README.md": "readme",
  "CHANGELOG.md": "changelog",
  LICENSE: "license",
  ".gitignore": "git",
};

declare global {
  interface Window {
    __zenImagesUri?: string;
  }
}

/**
 * Get icon filename for a given file based on extension
 * @param filename - The filename (with or without path)
 * @returns SVG icon filename (e.g. "javascript.svg")
 */
export function getFileIcon(filename: string): string {
  const name = filename.split("/").pop() || filename;
  const lower = name.toLowerCase();

  // 1. Exact filename match (e.g. "package.json", "README.md")
  if (EXT_ICON_MAP[lower]) return `${EXT_ICON_MAP[lower]}.svg`;

  // 2. Extension match
  const ext = lower.includes(".") ? lower.split(".").pop()! : "";
  if (EXT_ICON_MAP[ext]) return `${EXT_ICON_MAP[ext]}.svg`;

  // 3. Special pattern: test.*.ext → test icon
  if (/^test\./.test(lower)) {
    const testExt = lower.split(".").pop()!;
    if (testExt === "ts" || testExt === "tsx") return "test-ts.svg";
    if (testExt === "jsx") return "test-jsx.svg";
    return "test-js.svg";
  }

  // 4. Fallback
  return "file.svg";
}

/**
 * Get full icon path for use in img src
 * @param filename - The filename
 * @returns Full path to icon SVG
 */
export function getFileIconPath(filename: string): string {
  const iconName = getFileIcon(filename);
  const baseUri = window.__zenImagesUri || "/images/icon";
  const path = `${baseUri}/${iconName}`;
  return path.replace(/([^:]\/)\/+/g, "$1");
}

// ─── Folder Icon Mapping ──────────────────────────────────────────────────
const FOLDER_ICON_MAP: Record<string, string> = {
  src: "folder-src",
  source: "folder-src",
  components: "folder-components",
  component: "folder-components",
  ui: "folder-ui",
  node_modules: "folder-node",
  public: "folder-public",
  assets: "folder-images",
  images: "folder-images",
  img: "folder-images",
  styles: "folder-css",
  css: "folder-css",
  style: "folder-css",
  utils: "folder-utils",
  util: "folder-utils",
  helpers: "folder-helper",
  helper: "folder-helper",
  lib: "folder-lib",
  libs: "folder-lib",
  hooks: "folder-hook",
  hook: "folder-hook",
  types: "folder-typescript",
  typings: "folder-typescript",
  test: "folder-test",
  tests: "folder-test",
  __tests__: "folder-test",
  spec: "folder-test",
  docs: "folder-docs",
  doc: "folder-docs",
  documentation: "folder-docs",
  config: "folder-config",
  configs: "folder-config",
  dist: "folder-dist",
  build: "folder-dist",
  out: "folder-dist",
  output: "folder-dist",
  scripts: "folder-scripts",
  script: "folder-scripts",
  api: "folder-api",
  apis: "folder-api",
  git: "folder-git",
  ".git": "folder-git",
  github: "folder-github",
  ".github": "folder-github",
  vscode: "folder-vscode",
  ".vscode": "folder-vscode",
  packages: "folder-packages",
  package: "folder-packages",
  services: "folder-server",
  service: "folder-server",
  server: "folder-server",
  routes: "folder-routes",
  route: "folder-routes",
  router: "folder-routes",
  models: "folder-database",
  model: "folder-database",
  database: "folder-database",
  db: "folder-database",
  controllers: "folder-controller",
  controller: "folder-controller",
  middleware: "folder-middleware",
  views: "folder-views",
  view: "folder-views",
  pages: "folder-views",
  store: "folder-store",
  stores: "folder-store",
  redux: "folder-redux-reducer",
  state: "folder-redux-reducer",
  fonts: "folder-font",
  font: "folder-font",
  locales: "folder-i18n",
  locale: "folder-i18n",
  i18n: "folder-i18n",
  lang: "folder-i18n",
  translations: "folder-i18n",
  migrations: "folder-migrations",
  migration: "folder-migrations",
  seeders: "folder-seeders",
  seeder: "folder-seeders",
  logs: "folder-log",
  log: "folder-log",
  temp: "folder-temp",
  tmp: "folder-temp",
  docker: "folder-docker",
  env: "folder-environment",
  environments: "folder-environment",
  plugins: "folder-plugin",
  plugin: "folder-plugin",
  context: "folder-context",
  contexts: "folder-context",
  layouts: "folder-layout",
  layout: "folder-layout",
  app: "folder-app",
  core: "folder-core",
  shared: "folder-shared",
  common: "folder-shared",
  features: "folder-features",
  modules: "folder-modules",
  module: "folder-modules",
  interfaces: "folder-interface",
  interface: "folder-interface",
  events: "folder-event",
  event: "folder-event",
  commands: "folder-command",
  command: "folder-command",
  constants: "folder-constant",
  constant: "folder-constant",
  actions: "folder-redux-action",
  reducers: "folder-redux-reducer",
  selectors: "folder-redux-selector",
  graphql: "folder-graphql",
  android: "folder-android",
  ios: "folder-ios",
  python: "folder-python",
  java: "folder-java",
  javascript: "folder-javascript",
  js: "folder-javascript",
  ts: "folder-typescript",
  typescript: "folder-typescript",
  go: "folder-go",
  rust: "folder-rust",
  php: "folder-php",
  ruby: "folder-ruby",
  scala: "folder-scala",
  kotlin: "folder-kotlin",
  swift: "folder-swift",
  dart: "folder-dart",
  lua: "folder-lua",
  svelte: "folder-svelte",
  vue: "folder-vue",
  react: "folder-react-components",
  next: "folder-next",
  nuxt: "folder-nuxt",
  astro: "folder-astro",
  angular: "folder-angular",
  kubernetes: "folder-kubernetes",
  k8s: "folder-kubernetes",
  terraform: "folder-terraform",
  ansible: "folder-ansible",
  helm: "folder-helm",
  prisma: "folder-prisma",
  drizzle: "folder-drizzle",
  firebase: "folder-firebase",
  supabase: "folder-supabase",
  vercel: "folder-vercel",
  netlify: "folder-netlify",
  aws: "folder-aws",
  azure: "folder-azure-pipelines",
  gcp: "folder-gcp",
  cloud: "folder-cloud",
  ci: "folder-ci",
  ".circleci": "folder-circleci",
  ".buildkite": "folder-buildkite",
  workflow: "folder-gh-workflows",
  workflows: "folder-gh-workflows",
};

/**
 * Get folder icon name based on folder name
 */
export function getFolderIconName(
  folderName: string,
  isOpen: boolean = false,
): string {
  const key = folderName.toLowerCase();
  const base = FOLDER_ICON_MAP[key];
  if (base) {
    return isOpen ? `${base}-open.svg` : `${base}.svg`;
  }
  return isOpen ? DEFAULT_FOLDER_OPENED : DEFAULT_FOLDER;
}

/**
 * Get folder icon (backward compatible)
 */
export function getFolderIcon(isOpen: boolean = false): string {
  return isOpen ? DEFAULT_FOLDER_OPENED : DEFAULT_FOLDER;
}

/**
 * Get full folder icon path
 */
export function getFolderIconPath(
  folderName?: string,
  isOpen: boolean = false,
): string {
  const iconName = folderName
    ? getFolderIconName(folderName, isOpen)
    : getFolderIcon(isOpen);
  const baseUri = window.__zenImagesUri || "/images/icon";
  const path = `${baseUri}/${iconName}`;
  return path.replace(/([^:]\/)\/+/g, "$1");
}

/**
 * Get provider icon path
 */
export function getProviderIconPath(provider: string): string {
  const normalized = provider.toLowerCase();
  let iconName = "openai.svg";
  if (normalized.includes("claude") || normalized.includes("anthropic")) {
    iconName = "claude.svg";
  } else if (normalized.includes("gemini") || normalized.includes("google")) {
    iconName = "gemini.svg";
  } else if (normalized.includes("deepseek")) {
    iconName = "deepseek.svg";
  } else if (normalized.includes("grok") || normalized.includes("xai")) {
    iconName = "grok.svg";
  } else if (normalized.includes("openai") || normalized.includes("gpt")) {
    iconName = "openai.svg";
  }
  const baseUri = window.__zenImagesUri || "/images/icon";
  const path = `${baseUri}/provider_icons/${iconName}`;
  return path.replace(/([^:]\/)\/+/g, "$1");
}
