# LIFEQUEST release readiness — 2026-10-20

## Confirmed in this working session
- Inspected the existing TypeScript/React source and current application modules.
- Corrected Vocabulary Apprentice unlock condition to count the fifth newly mastered English Magick lesson (rather than awarding the badge on an already-mastered lesson).
- Ran `node --test tests/*.test.mjs`: 7/7 passed. These are source/logic checks, not browser integration tests.

## Unverified / unfinished
- Dependency installation is blocked in this environment by DNS failure to registry.npmjs.org. No production build or TypeScript compile was possible.
- No Android APK was generated, and no real-device tests were performed.
- The original master specification has not been fully audited against implemented screens, workflows, and persistence.
- The Oracle is a local rules advisor, not an external AI service.

## Build commands when npm access is available
At the workspace root:
`corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm run typecheck && corepack pnpm --filter @workspace/lifequest build`

For Android after successful web build, run Capacitor sync from `artifacts/lifequest` using its configured Android scripts and build with Android Studio.

Do not treat the source test pass as proof of production readiness.
