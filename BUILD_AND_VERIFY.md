# LIFEQUEST build and verification handoff

This is a source checkpoint, NOT a verified release. Do not publish an APK until the commands and device tests pass.

## Install and build

From the repository root, with Node 22 and pnpm available:

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm --filter @workspace/lifequest build
```

## Android build (after web build succeeds)

```sh
cd artifacts/lifequest
pnpm exec cap add android  # first build only
pnpm exec cap sync android
pnpm exec cap open android
```

Use Android Studio to build an APK, test on a device, and sign a release build with a securely stored keystore. Never commit the keystore or passwords.

## Required device tests

Character creation and refresh persistence; one-time and recurring XP award protection; skill progression; financial ledger totals; lessons; achievements; Oracle and decision history; backup/restore/erase; airplane-mode relaunch; install and restart; navigation and accessibility; Android WebView persistence. Record outcomes before claiming completion.

## Current constraints

The source contains the MVP and expanded modules but has not passed dependency installation, TypeScript, runtime, device, or Android compilation in this environment. npm registry access failed (`EAI_AGAIN registry.npmjs.org`). No APK was generated.
