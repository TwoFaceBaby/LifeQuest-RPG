# LIFEQUEST — source audit and continuation

This package is an updated copy of the supplied source, not a claim that the full master specification is complete.

## Implemented in this revision
- Restoring a validated JSON backup now downloads a timestamped safety backup of the previously persisted player record before replacement.
- The restore confirmation explains the automatic safety backup.
- Backups receive timestamped filenames to avoid collisions.

## Already present in supplied source (requires runtime verification)
- Character creation, quests, XP, skill tracking, achievements, local IndexedDB persistence.
- Business, training, language and social modules in PhaseTwo.tsx.
- Export, restore validation and confirmed erase controls.
- PWA manifest and service worker.

## Still requires work and verification
- Run `corepack pnpm install`, `corepack pnpm run typecheck`, and `corepack pnpm run build` in a network-enabled Node environment.
- Test backup/restore/erase in an actual browser, including quota errors, download permissions, and refresh.
- Verify offline installation, mobile layout, all gameplay flows, accessibility and performance.
- Complete any unimplemented advanced features from the original specification before calling the product finished.

## Run
From repository root: `corepack pnpm install` then `corepack pnpm --filter @workspace/lifequest dev`.
