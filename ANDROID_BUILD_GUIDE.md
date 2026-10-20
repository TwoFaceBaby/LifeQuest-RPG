# LIFEQUEST Android build (debug APK)

The `.github/workflows/android-debug-apk.yml` workflow builds an Android **debug** APK on GitHub Actions, using the current web app. It does not publish to Google Play or create a release signing key.

1. Commit the complete repository to GitHub (including `pnpm-lock.yaml` and the `.github/workflows` directory).
2. Open **Actions → LIFEQUEST Android debug APK → Run workflow**.
3. After the job succeeds, download the **LIFEQUEST-debug-APK** artifact and extract the APK to install on your Android device.
4. Confirm first launch, offline behavior, quest completion, backup/restore and device persistence. A debug APK is for testing; release distribution requires a securely stored release signing key.

The workflow has not been run in this environment. It may reveal dependency, Gradle or Android SDK issues that require fixes. Do not assume it succeeded until the Actions job is green.
