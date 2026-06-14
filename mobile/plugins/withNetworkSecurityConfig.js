// Expo config plugin — copies network-security-config.xml into the Android
// project and wires it into AndroidManifest during `expo prebuild` / EAS Build.
//
// expo-build-properties does not implement the networkSecurityConfig option,
// so this plugin handles it directly via withAndroidManifest + withDangerousMod.
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withNetworkSecurityConfig = (config) => {
  // Step 1: copy the XML into android/app/src/main/res/xml/
  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const { platformProjectRoot } = modConfig.modRequest;
      const resXmlDir = path.join(platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      if (!fs.existsSync(resXmlDir)) fs.mkdirSync(resXmlDir, { recursive: true });
      const src = path.join(__dirname, '..', 'network-security-config.xml');
      fs.copyFileSync(src, path.join(resXmlDir, 'network_security_config.xml'));
      return modConfig;
    },
  ]);

  // Step 2: set android:networkSecurityConfig on <application> in AndroidManifest
  config = withAndroidManifest(config, (modConfig) => {
    const app = modConfig.modResults.manifest.application?.[0];
    if (app) {
      app.$ = app.$ ?? {};
      app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    }
    return modConfig;
  });

  return config;
};

module.exports = withNetworkSecurityConfig;
