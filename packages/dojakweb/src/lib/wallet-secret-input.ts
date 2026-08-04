import type { InputHTMLAttributes } from 'react';

type PasswordManagerIgnoreProps = InputHTMLAttributes<HTMLInputElement> & {
  'data-form-type'?: string;
  'data-lpignore'?: string;
  'data-1p-ignore'?: string;
  'data-bwignore'?: string;
  'data-protonpass-ignore'?: string;
};

/**
 * Local wallet encryption secrets are NOT website logins.
 * These attrs reduce Chrome / 1Password / Bitwarden save prompts without changing crypto behavior.
 */
export const ignoreBrowserPasswordManager: PasswordManagerIgnoreProps = {
  autoComplete: 'new-password',
  'data-form-type': 'other',
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-bwignore': 'true',
  'data-protonpass-ignore': 'true',
};

/** Decoy fields — Chrome scans the first password-ish input in a form. */
export const walletSecretDecoyFields: InputHTMLAttributes<HTMLInputElement>[] = [
  {
    tabIndex: -1,
    autoComplete: 'username',
    name: 'dojakweb-decoy-user',
    'aria-hidden': true,
    className: 'pointer-events-none absolute h-0 w-0 opacity-0',
  },
  {
    tabIndex: -1,
    type: 'password',
    autoComplete: 'current-password',
    name: 'dojakweb-decoy-pass',
    'aria-hidden': true,
    className: 'pointer-events-none absolute h-0 w-0 opacity-0',
  },
];

/** Chrome often ignores `off` until first focus — brief readonly blocks autofill heuristics. */
export function walletSecretInputProps(
  fieldName: string,
  options?: { pin?: boolean },
): InputHTMLAttributes<HTMLInputElement> {
  return {
    ...ignoreBrowserPasswordManager,
    name: fieldName,
    id: fieldName,
    readOnly: true,
    spellCheck: false,
    autoCorrect: 'off',
    autoCapitalize: 'off',
    onFocus: (event) => {
      event.currentTarget.removeAttribute('readonly');
    },
    ...(options?.pin
      ? { inputMode: 'numeric', pattern: '[0-9]*', autoComplete: 'one-time-code' }
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
