# Holy Padel Site

Static Next.js content site for Holy Padel.

The site uses the same court-bold visual language as the mobile app and exports
plain static files into `out/` for GitHub Pages.

## Commands

```sh
pnpm --filter @holy-padel/site dev
pnpm --filter @holy-padel/site build
pnpm --filter @holy-padel/site typecheck
pnpm --filter @holy-padel/site lint
```

## GitHub Pages

The root `.github/workflows/site.yml` workflow builds this package on pull
requests that touch `apps/site/**`. After those changes are merged to `main`, it
exports the site with the `/holy-padel` base path and deploys `apps/site/out` to
GitHub Pages.
