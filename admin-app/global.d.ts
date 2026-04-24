/**
 * Global type declarations for the admin-app.
 *
 * Allows side-effect imports of stylesheets and static assets without
 * TS complaining about missing type declarations. Vite handles these
 * at runtime; TS just needs to know the module names are valid.
 */

declare module '*.css';
declare module '*.scss';
declare module '*.sass';
declare module '*.svg';
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.webp';

/**
 * Vite's import.meta.env shape.
 *
 * Vite ships its own `vite/client.d.ts` but it isn't auto-included unless
 * you add `"vite/client"` to tsconfig.types. We inline a small subset here
 * so we don't have to expand tsconfig.types (which turns off the auto-include
 * of @types/node + @types/react).
 */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_PORTAL_URL?: string;
  readonly VITE_STOREFRONT_URL?: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
  readonly BASE_URL: string;
  [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
