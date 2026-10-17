// RN 0.76 passes the Android entry relative to apps/mobile on Windows.
// Expo 52 must resolve that entry from the same root, while watchFolders still
// include the workspace for the shared API client and hoisted node_modules.
process.env.EXPO_NO_METRO_WORKSPACE_ROOT = '1';
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);
const workspaceRoot = path.resolve(__dirname, '../..');
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [path.join(__dirname, 'node_modules'), path.join(workspaceRoot, 'node_modules')];
// Leave memory available for Gradle, Docker and the Android emulator on 16 GB PCs.
config.maxWorkers = 2;
module.exports = config;
