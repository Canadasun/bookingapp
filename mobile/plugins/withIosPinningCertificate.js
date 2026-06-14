/* global __dirname */
const { IOSConfig, withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const { X509Certificate } = require('crypto');
const fs = require('fs');
const path = require('path');

const CERT_NAME = 'lets-encrypt-yr2.cer';

const withIosPinningCertificate = (config) => {
  config = withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const source = path.join(__dirname, '..', 'certificates', 'lets-encrypt-yr2.txt');
      const destination = path.join(modConfig.modRequest.platformProjectRoot, CERT_NAME);
      const certificate = new X509Certificate(fs.readFileSync(source));
      fs.writeFileSync(destination, certificate.raw);
      return modConfig;
    },
  ]);

  return withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    if (!project.hasFile(CERT_NAME)) {
      IOSConfig.XcodeUtils.ensureGroupRecursively(project, 'Resources');
      modConfig.modResults = IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: CERT_NAME,
        groupName: 'Resources',
        project,
        isBuildFile: true,
      });
    }
    return modConfig;
  });
};

module.exports = withIosPinningCertificate;
