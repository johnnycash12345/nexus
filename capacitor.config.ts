import type { CapacitorConfig } from '@capacitor/cli';

// FIX: Removed the deprecated 'bundledWebRuntime' property from the configuration object below as it is no longer a valid property.
const config: CapacitorConfig = {
  appId: 'com.nexus.assistant',
  appName: 'Nexus Assistant',
  webDir: 'dist',
};

export default config;