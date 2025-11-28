#!/usr/bin/env node

const { execSync } = require('child_process');
const os = require('os');

console.log('🧹 Cleaning up existing Node.js and webpack processes before build...');

const currentPid = process.pid;

if (os.platform() === 'win32') {
  // Windows: Kill other node processes but not ourselves
  try {
    console.log('Killing other Node.js processes on Windows...');
    // Get list of node processes, filter out current process, and kill them
    const output = execSync('tasklist /fi "imagename eq node.exe" /fo csv /nh', { encoding: 'utf8', stdio: 'pipe' });
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const parts = line.split(',');
      if (parts.length >= 2) {
        const pid = parts[1].replace(/"/g, '');
        if (pid && pid !== currentPid.toString()) {
          try {
            execSync(`taskkill /f /pid ${pid}`, { stdio: 'pipe' });
            console.log(`Killed Node.js process ${pid}`);
          } catch (e) {
            // Process might have already exited - this is fine
          }
        }
      }
    }
  } catch (e) {
    // Ignore errors if tasklist fails
  }
} else {
  // Unix-like systems
  try {
    console.log('Killing Node.js processes on Unix...');
    execSync('pkill -9 -f "node.*webpack" 2>/dev/null || true', { stdio: 'pipe' });
    execSync('pkill -9 -f "webpack" 2>/dev/null || true', { stdio: 'pipe' });
    execSync('pkill -9 -f "node --max-old-space-size" 2>/dev/null || true', { stdio: 'pipe' });
  } catch (e) {
    // Ignore all errors
  }
}

console.log('✅ Build environment cleaned. Starting fresh build...');
// Exit cleanly so npm can continue with the && webpack command
process.exit(0);
