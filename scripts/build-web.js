const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const landingDir = path.join(rootDir, 'landing-page');
const expoOutDir = path.join(rootDir, 'dist-app');
const distDir = path.join(rootDir, 'dist');
const appDir = path.join(distDir, 'app');

function removeDir(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(from, to) {
    if (fs.existsSync(from)) {
        fs.cpSync(from, to, { recursive: true });
    }
}

removeDir(expoOutDir);
removeDir(distDir);

const expoBin = process.execPath;
const expoCli = path.join(rootDir, 'node_modules', 'expo', 'bin', 'cli');

execFileSync(expoBin, [expoCli, 'export', '--platform', 'web', '--output-dir', expoOutDir], {
    cwd: rootDir,
    stdio: 'inherit',
});

fs.mkdirSync(appDir, { recursive: true });

copyDir(landingDir, distDir);
copyDir(path.join(expoOutDir, '_expo'), path.join(distDir, '_expo'));
copyDir(path.join(expoOutDir, 'assets'), path.join(distDir, 'assets'));
fs.copyFileSync(path.join(expoOutDir, 'index.html'), path.join(appDir, 'index.html'));
fs.copyFileSync(path.join(expoOutDir, 'metadata.json'), path.join(appDir, 'metadata.json'));

removeDir(expoOutDir);
