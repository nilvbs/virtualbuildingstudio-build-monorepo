// Metro configured for a pnpm monorepo.
// Watch workspace packages, resolve from app + root node_modules, and ignore
// install leftovers / unrelated apps so the file watcher does not crash.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Prefer explicit nodeModulesPaths in a monorepo / hoisted pnpm layout.
config.resolver.disableHierarchicalLookup = true;

// Ignore pnpm install leftovers and sibling apps Metro never needs.
config.resolver.blockList = [
  /_tmp_\d+([/\\]|$)/,
  /[/\\]apps[/\\]api[/\\]/,
  /[/\\]apps[/\\]web[/\\]/,
];

config.resolver.extraNodeModules = {
  'expo-modules-core': path.resolve(workspaceRoot, 'node_modules/expo-modules-core'),
  expo: path.resolve(workspaceRoot, 'node_modules/expo'),
  'react-native': path.resolve(workspaceRoot, 'node_modules/react-native'),
  react: path.resolve(workspaceRoot, 'node_modules/react'),
  'react-dom': path.resolve(workspaceRoot, 'node_modules/react-dom'),
  'react-native-web': path.resolve(workspaceRoot, 'node_modules/react-native-web'),
};

module.exports = config;
