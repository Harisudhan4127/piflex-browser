'use strict';

const os = require('os');
const { app } = require('electron');

const MB = 1024 * 1024;

function memoryInfo() {
  const totalMB = Math.round(os.totalmem() / MB);
  const freeMB = Math.round(os.freemem() / MB);
  return {
    totalMB,
    freeMB,
    usedMB: Math.max(0, totalMB - freeMB),
    pressure: totalMB > 0 ? freeMB / totalMB : 1,
  };
}

function cpuInfo() {
  const cpus = os.cpus();
  return {
    model: cpus.length ? String(cpus[0].model || '').trim() : 'Unknown CPU',
    cores: cpus.length,
  };
}

/**
 * Classify the CPU architecture family. PiFlex targets x86-64 and AArch64/ARM64
 * desktop and laptop machines. 32-bit ARM is recognised but treated as legacy.
 */
function archFamily(arch) {
  if (arch === 'x64' || arch === 'ia32') return 'x86';
  if (arch === 'arm64') return 'arm64';
  if (arch === 'arm') return 'arm';
  return 'other';
}

function hardwareInfo() {
  const cpu = cpuInfo();
  const memory = memoryInfo();
  const family = archFamily(process.arch);
  return {
    platform: process.platform,
    arch: process.arch,
    archFamily: family,
    osRelease: os.release(),
    cpuModel: cpu.model,
    cpuCores: cpu.cores,
    ...memory,
    isDesktop: family === 'x86' || family === 'arm64',
    isLowMemory: memory.totalMB <= 4096,
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      v8: process.versions.v8,
    },
    appVersion: app.getVersion(),
  };
}

function isMemoryPressure(memory = memoryInfo()) {
  const floorMB = Math.max(384, Math.round(memory.totalMB * 0.1));
  return memory.freeMB < floorMB;
}

/**
 * Adaptive disk cache sizing: honour the configured value but cap it against
 * available RAM so laptops with modest memory keep a small cache.
 */
function recommendedDiskCacheMB(configuredMB, memory = memoryInfo()) {
  const configured = Math.max(32, Math.min(4096, Number(configuredMB) || 256));
  const adaptiveCap = Math.max(64, Math.round(memory.totalMB / 10));
  return Math.min(configured, adaptiveCap);
}

function recommendedMaxTabs(memory = memoryInfo()) {
  if (memory.totalMB <= 4096) return 20;
  if (memory.totalMB <= 8192) return 40;
  return 80;
}

module.exports = {
  archFamily,
  hardwareInfo,
  isMemoryPressure,
  memoryInfo,
  recommendedDiskCacheMB,
  recommendedMaxTabs,
};
