type ViteEnv = Record<string, string | boolean | undefined>;

/** Safe `import.meta.env` — Vite injects it; Next/webpack often leave `import.meta.env` undefined. */
export function getViteEnv(): ViteEnv | undefined {
  try {
    const envGetter = Function(
      'return (typeof import !== "undefined" && import.meta && import.meta.env) ? import.meta.env : undefined;',
    ) as () => ViteEnv | undefined;
    return envGetter();
  } catch {
    return undefined;
  }
}

/**
 * Vite `import.meta.env.DEV` only. Do **not** treat Next `NODE_ENV===development` as Vite DEV —
 * that would send browsers to `/__commanddog` without the demo's Vite proxy.
 */
export function isViteDev(): boolean {
  return getViteEnv()?.DEV === true;
}

export function getEnv(name: string, fallback = ''): string {
  const processValue =
    typeof process !== 'undefined' && process?.env
      ? (process.env[name] as string | undefined)
      : undefined;

  const viteValue = getViteEnv()?.[name];
  const viteStr = typeof viteValue === 'string' ? viteValue : undefined;

  return processValue ?? viteStr ?? fallback;
}
