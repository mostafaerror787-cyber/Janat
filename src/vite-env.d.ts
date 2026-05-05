/// <reference types="vite/client" />

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace NodeJS {
  interface ProcessEnv {
    readonly GEMINI_API_KEY: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};
