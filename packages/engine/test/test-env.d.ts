// Minimal typings for the Vite/Vitest import features used by engine tests
// (kept local: the engine has no vite or node type dependencies by design).
interface ImportMeta {
  glob(pattern: string, options: { query: '?raw'; import: 'default'; eager: true }): Record<string, string>;
}

declare module '*?raw' {
  const content: string;
  export default content;
}
