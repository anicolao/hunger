#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${IN_NIX_SHELL:-}" ]]; then
  exec nix develop --command bun run verify:change
fi

git diff --cached --check
git diff --check
bun run check
bun run test:unit
bun run test:e2e
bun run build
if rg -q '__HUNGER_E2E__|data-e2e-fixture' build; then
  echo 'Development fixture boundary leaked into the production build.' >&2
  exit 1
fi
