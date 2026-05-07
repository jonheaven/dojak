$ErrorActionPreference = "Stop"
pnpm --filter @dojak/extension exec gulp watch --env=dev --browser=chrome --manifest=mv3 --channel=github
