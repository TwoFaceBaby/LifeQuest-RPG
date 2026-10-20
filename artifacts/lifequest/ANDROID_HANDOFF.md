# LIFEQUEST Android handoff — APK not yet generated

This folder contains a Capacitor configuration, not an Android project or APK.

## Before building the APK
1. Install Node.js 22+, pnpm and Android Studio with Android SDK/JDK on a PC or a supported CI runner.
2. At repository root run `pnpm install` then `pnpm --filter @workspace/lifequest typecheck` and `pnpm --filter @workspace/lifequest build`.
3. Fix any reported failures; do not proceed with an unverified build.
4. From `artifacts/lifequest` run `pnpm exec cap add android` once (this generates the Android native project).
5. Run `pnpm exec cap sync android`, then `pnpm exec cap open android`.
6. Test app launch, offline operation, persistence, backup/restore, XP and financial totals on a real Android device.
7. Generate and sign the APK only after tests pass; keep the signing keystore private.

### Cautions
- Browser IndexedDB data from the hosted PWA is **not automatically transferred** into the Capacitor Android app. Export a JSON backup in the browser and restore it inside the app.
- Native Android file downloads and imports need explicit on-device testing; web download behavior may differ in WebView.
- App ID is a provisional unique identifier; decide the final package name before release.
- Never commit signing keys, passwords, or API credentials.
