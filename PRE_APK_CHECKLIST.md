# LIFEQUEST — pre-APK completion checklist

## Confirmed from source inspection
- React/TypeScript Vite workspace exists.
- IndexedDB state, XP and quest completion rules are present.
- World modules, local backup/restore/erase UI, PWA manifest and service worker exist.
- Capacitor configuration added for eventual Android packaging.
- Vite configuration no longer fails solely because Replit-specific environment variables are absent.

## Not verified — do not describe as complete
- Dependencies can install and workspace typecheck/build pass.
- Full acceptance test suite and real Android browser tests.
- Offline cache correctness after an update and under navigation.
- Backup/restore file picker and download behavior inside Android WebView.
- All modules, forms, persistence and financial computations behave correctly.
- Accessibility and responsiveness on target devices.
- Capacitor Android native project generation, compilation, signing and APK install.

## Required pre-APK gate
- Run typecheck, production build and feature-level tests.
- Verify all 20 original functional acceptance tests, especially XP duplication prevention.
- Verify offline persistence and restore after restart.
- Complete Android WebView tests before signing.

No APK is included. This checklist is a verification gate, not evidence of passing tests.
