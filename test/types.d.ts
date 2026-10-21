// Type augmentations for the test setup in vitest.config.ts. Packages with tests include this
// file from their tsconfig.json.

// Testing Library DOM matchers (`toBeInTheDocument`, ...), registered in test/unit/setup-dom.ts.
/// <reference types="@testing-library/jest-dom/vitest" />

import "vitest";

declare module "vitest" {
  // Values handed from test/integration/global-setup.ts to test files via `inject()`. Module
  // augmentation needs declaration merging, so this has to be an interface.
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  export interface ProvidedContext {
    databaseUrl: string;
    baseUrl: string;
  }
}
