import type { InputHTMLAttributes } from 'react';

/**
 * Local wallet encryption secrets are NOT website logins.
 * These attrs reduce Chrome / 1Password / Bitwarden save prompts without changing crypto behavior.
 */
export const ignoreBrowserPasswordManager: Pick<
  InputHTMLAttributes<HTMLInputElement>,
  'autoComplete' | 'data-form-type' | 'data-lpignore' | 'data-1p-ignore' | 'data-bwignore'
> = {
  autoComplete: 'off',
  'data-form-type': 'other',
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-bwignore': 'true',
};

/** Chrome often ignores `off` until first focus — brief readonly blocks autofill heuristics. */
export function walletSecretInputProps(
  fieldName: string,
  options?: { pin?: boolean },
): InputHTMLAttributes<HTMLInputElement> {
  return {
    ...ignoreBrowserPasswordManager,
    name: fieldName,
    readOnly: true,
    onFocus: (event) => {
      event.currentTarget.removeAttribute('readonly');
    },
    ...(options?.pin
      ? { inputMode: 'numeric', pattern: '[0-9]*' }
      : {}),
  };
}

/** RPC / API keys in settings — not user account passwords. */
export function walletCredentialInputProps(fieldName: string): InputHTMLAttributes<HTMLInputElement> {
  return {
    ...ignoreBrowserPasswordManager,
    name: fieldName,
    autoComplete: 'off',
  };
}
