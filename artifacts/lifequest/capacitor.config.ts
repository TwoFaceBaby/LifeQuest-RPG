import type { CapacitorConfig } from '@capacitor/cli';

// APK creation is intentionally a later, user-controlled step.
const config: CapacitorConfig = {
  appId: 'app.lifequest.realityrpg',
  appName: 'LIFEQUEST',
  webDir: 'dist/public',
  bundledWebRuntime: false,
};
export default config;
