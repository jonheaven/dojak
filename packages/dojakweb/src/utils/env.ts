export function getEnv(name: string, fallback = ''): string {
  const processValue =
    typeof process !== 'undefined' && process?.env
      ? (process.env[name] as string | undefined)
      : undefined;

  let viteValue: string | undefined;
  try {
    const envGetter = Function(
      'return (typeof import !== "undefined" && import.meta && import.meta.env) ? import.meta.env : undefined;'
    ) as () => Record<string, string> | undefined;
    viteValue = envGetter()?.[name];
  } catch {
    viteValue = undefined;
  }

  return processValue ?? viteValue ?? fallback;
}
