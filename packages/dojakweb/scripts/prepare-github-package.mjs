#!/usr/bin/env node
/**
 * Prepare a GitHub Packages–publishable tarball root for the wallet embed.
 *
 * Published name: @jonheaven/dojak-web  (GitHub requires @OWNER scope)
 * Consumers map it back with:
 *   "@dojak/web": "npm:@jonheaven/dojak-web@^x.y.z"
 *
 * Usage (from monorepo root or this package):
 *   node packages/dojakweb/scripts/prepare-github-package.mjs
 *   → writes packages/dojakweb/.publish-github/
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");
const monorepoRoot = path.resolve(pkgRoot, "../..");
const outDir = path.join(pkgRoot, ".publish-github");

const srcPkg = JSON.parse(
  fs.readFileSync(path.join(pkgRoot, "package.json"), "utf8"),
);

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

console.log("[dojak-web] build:lib …");
execSync("pnpm --filter @dojak/web run build:lib", {
  cwd: monorepoRoot,
  stdio: "inherit",
  env: { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: "0" },
});

const walletJs = path.join(pkgRoot, "dist", "wallet.js");
const hostCss = path.join(pkgRoot, "dojakweb-host.css");
const walletDts = path.join(pkgRoot, "wallet.d.ts");

for (const required of [walletJs, hostCss, walletDts]) {
  if (!fs.existsSync(required)) {
    throw new Error(`[dojak-web] missing required file: ${required}`);
  }
}

rmrf(outDir);
fs.mkdirSync(path.join(outDir, "dist"), { recursive: true });

copyFile(walletJs, path.join(outDir, "dist", "wallet.js"));
const walletMap = `${walletJs}.map`;
if (fs.existsSync(walletMap)) {
  copyFile(walletMap, path.join(outDir, "dist", "wallet.js.map"));
}
copyFile(hostCss, path.join(outDir, "dojakweb-host.css"));
copyFile(walletDts, path.join(outDir, "wallet.d.ts"));

const publishPkg = {
  name: "@jonheaven/dojak-web",
  version: srcPkg.version,
  description:
    "Private first-party Dogecoin wallet embed (Dojakweb) for jonheaven dApps. Not for public redistribution.",
  type: "module",
  license: "UNLICENSED",
  repository: {
    type: "git",
    url: "https://github.com/jonheaven/dojak.git",
    directory: "packages/dojakweb",
  },
  publishConfig: {
    registry: "https://npm.pkg.github.com",
    access: "restricted",
  },
  main: "./dist/wallet.js",
  module: "./dist/wallet.js",
  types: "./wallet.d.ts",
  exports: {
    ".": {
      import: "./dist/wallet.js",
      types: "./wallet.d.ts",
    },
    "./wallet": {
      import: "./dist/wallet.js",
      types: "./wallet.d.ts",
    },
    "./dojakweb-host.css": "./dojakweb-host.css",
    "./wallet.css": "./dojakweb-host.css",
  },
  files: [
    "dist/wallet.js",
    "dist/wallet.js.map",
    "dojakweb-host.css",
    "wallet.d.ts",
  ],
  peerDependencies: {
    react: ">=18",
    "react-dom": ">=18",
  },
  // Prebundled embed — no workspace/@dojak/* runtime deps for hosts.
  dependencies: {},
};

fs.writeFileSync(
  path.join(outDir, "package.json"),
  `${JSON.stringify(publishPkg, null, 2)}\n`,
  "utf8",
);

fs.writeFileSync(
  path.join(outDir, "README.md"),
  `# @jonheaven/dojak-web

Private GitHub Packages build of Dojakweb wallet embed.

\`\`\`bash
# .npmrc
@jonheaven:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=\${NODE_AUTH_TOKEN}
\`\`\`

\`\`\`json
{
  "dependencies": {
    "@dojak/web": "npm:@jonheaven/dojak-web@^${srcPkg.version}"
  }
}
\`\`\`

\`\`\`ts
import { DojakWalletProvider, ConnectWalletButton } from "@dojak/web/wallet";
import "@dojak/web/wallet.css";
\`\`\`
`,
  "utf8",
);

console.log(`[dojak-web] publish root ready → ${outDir}`);
console.log(
  `[dojak-web] next: npm publish --access restricted (from .publish-github/)`,
);
