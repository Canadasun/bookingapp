// Expo config plugin — writes PrivacyInfo.xcprivacy into the iOS app directory
// during `expo prebuild` (and therefore during every EAS Build).
//
// Apple requires this file for all App Store submissions targeting iOS 17+.
// It declares which privacy-sensitive APIs the app and its native modules access.
//
// Reason codes reference: https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// NSPrivacyAccessedAPITypeReasons codes used by bundled Expo/RN native modules:
//   35F9.1 — SystemBootTime: used by expo-local-authentication, react-native internals
//            for time-delta calculations that don't identify the user.
//   C617.1 — FileTimestamp: used by the file system when uploading images (logo,
//             avatar, cover) to detect whether a cached file is stale.
//   CA92.1 — UserDefaults: used by expo-secure-store and Expo's module registry
//             to persist non-sensitive preferences (e.g. scheme, colour mode).
const PRIVACY_MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>NSPrivacyTracking</key>
\t<false/>
\t<key>NSPrivacyTrackingDomains</key>
\t<array/>
\t<key>NSPrivacyCollectedDataTypes</key>
\t<array/>
\t<key>NSPrivacyAccessedAPITypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategorySystemBootTime</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array>
\t\t\t\t<string>35F9.1</string>
\t\t\t</array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array>
\t\t\t\t<string>C617.1</string>
\t\t\t</array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategoryUserDefaults</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array>
\t\t\t\t<string>CA92.1</string>
\t\t\t</array>
\t\t</dict>
\t</array>
</dict>
</plist>
`;

/**
 * @param {import('@expo/config-plugins').ExpoConfig} config
 * @returns {import('@expo/config-plugins').ExpoConfig}
 */
const withPrivacyManifest = (config) =>
  withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const { platformProjectRoot, projectName } = modConfig.modRequest;
      // platformProjectRoot = <repo>/mobile/ios
      // projectName         = the Xcode target folder, e.g. "Mobile"
      const appDir = path.join(platformProjectRoot, projectName);
      if (!fs.existsSync(appDir)) {
        fs.mkdirSync(appDir, { recursive: true });
      }
      fs.writeFileSync(path.join(appDir, 'PrivacyInfo.xcprivacy'), PRIVACY_MANIFEST, 'utf-8');
      return modConfig;
    },
  ]);

module.exports = withPrivacyManifest;
