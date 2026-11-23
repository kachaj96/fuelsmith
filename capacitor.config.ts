import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.kachaj96.fuelsmith',
  appName: 'Fuelsmith',
  webDir: 'dist',
  android: { allowMixedContent: false },
  // fetch goes through the native HTTP stack: the User-Agent that Open Food Facts asks for is really sent
  plugins: { CapacitorHttp: { enabled: true } },
};

export default config;
