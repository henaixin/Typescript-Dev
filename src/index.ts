#!/usr/bin/env node

import * as os from 'os';

interface PlatformInfo {
  platform: NodeJS.Platform;
  arch: string;
  nodeVersion: string;
  release: string;
  homedir: string;
}

function getPlatformInfo(): PlatformInfo {
  return {
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    release: os.release(),
    homedir: os.homedir(),
  };
}

function formatInfo(info: PlatformInfo): string {
  return `
============================================
       TypeScript Demo Application
============================================
  Platform:   ${info.platform}
  Arch:       ${info.arch}
  Node.js:    ${info.nodeVersion}
  OS Release: ${info.release}
  Home Dir:   ${info.homedir}
============================================
  Hello from TypeScript!
============================================
`;
}

function main() {
  const info = getPlatformInfo();
  console.log(formatInfo(info));
}

main();
