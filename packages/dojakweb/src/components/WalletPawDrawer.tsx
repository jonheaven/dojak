'use client';

/**
 * @deprecated Use `WalletDrawer` — the Shiba paw is built into the web wallet drawer.
 * Kept as an alias so older host imports keep working without a host-local implementation.
 */
import WalletDrawer, { type WalletDrawerProps } from './WalletDrawer';

export type WalletPawDrawerProps = WalletDrawerProps;
export const WalletPawDrawer = WalletDrawer;
export default WalletDrawer;
