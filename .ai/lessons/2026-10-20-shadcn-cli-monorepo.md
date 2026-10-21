# shadcn CLI in the `@wpas/ui` workspace

- **Context:** adding `button` and `card` with `npx shadcn@4.22.1 add` from `packages/ui`.
- **Finding:**
  1. The CLI refuses to run unless _every_ alias in `components.json` (including `hooks`)
     resolves through the package `exports` map or tsconfig paths.
  2. With `utils: "@wpas/ui/lib/utils"` it wrote `import { cn } from "cn"` into the generated
     components **and installed the unrelated npm package `cn`** as a dependency.
- **Fix / Rule:** after every `shadcn add`, review the diff: the utils import must be
  `@wpas/ui/lib/utils` and `packages/ui/package.json` must not gain unexpected deps. Remove
  any stray package with `npm uninstall <pkg> -w @wpas/ui`.
- **Related:** .ai/runs/2026-10-20-monorepo-foundation.md, packages/ui/components.json
