// Builds the KDE Plasma 6 wallpaper package (see docs/WALLPAPER.md):
//   dist/plasma-wallpaper/                  the package folder (kpackagetool6 can install it directly)
//   dist/gcdatlas-plasma-wallpaper.tar.gz   the same files at the archive root, for releases
// No dependencies beyond Node and tar. Run with `npm run wallpaper`.
// Run with `npm run wallpaper:install` (or `--install`) to install directly to ~/.local/share/plasma/wallpapers/.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'kde-wallpaper'), DIST = path.join(ROOT, 'dist');
const PKG = path.join(DIST, 'plasma-wallpaper'), ARCHIVE = path.join(DIST, 'gcdatlas-plasma-wallpaper.tar.gz');

execFileSync(process.execPath, [path.join(ROOT, 'build.mjs')], { stdio:'inherit' });

fs.rmSync(PKG, { recursive:true, force:true });
fs.cpSync(path.join(SRC, 'contents'), path.join(PKG, 'contents'), { recursive:true });
fs.copyFileSync(path.join(DIST, 'index.html'), path.join(PKG, 'contents', 'gcdatlas.html'));
// the plugin carries the site's version, so a bug report names the build
const meta = JSON.parse(fs.readFileSync(path.join(SRC, 'metadata.json'), 'utf8'));
meta.KPlugin.Version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
fs.writeFileSync(path.join(PKG, 'metadata.json'), JSON.stringify(meta, null, 4) + '\n');

fs.rmSync(ARCHIVE, { force:true });
execFileSync('tar', ['-czf', ARCHIVE, '-C', PKG, 'metadata.json', 'contents']);

// check the result: every file in place, at the archive root, and the page opened in wallpaper mode
const listed = execFileSync('tar', ['-tzf', ARCHIVE], { encoding:'utf8' }).split('\n').filter(Boolean).map(f => f.replace(/^\.\//, ''));
const need = ['metadata.json', 'contents/ui/main.qml', 'contents/ui/config.qml', 'contents/config/main.xml', 'contents/gcdatlas.html'];
const missing = need.filter(f => !listed.includes(f));
const problems = [];
if (missing.length) problems.push('missing from the archive: ' + missing.join(', '));
if (!meta.KPlugin.Id || meta.KPackageStructure !== 'Plasma/Wallpaper') problems.push('metadata.json is not a Plasma wallpaper');
if (!fs.readFileSync(path.join(PKG, 'contents', 'ui', 'main.qml'), 'utf8').includes('?wallpaper=1')) problems.push('main.qml does not open the page in wallpaper mode');
if (problems.length){ console.error('wallpaper package FAILED\n' + problems.join('\n')); process.exit(1); }
const kb = Math.round(fs.statSync(ARCHIVE).size/1024);
console.log(`wallpaper ${meta.KPlugin.Version} -> ${path.relative(ROOT, PKG)}/ and ${path.relative(ROOT, ARCHIVE)} (${kb} KB)`);

if (process.argv.includes('--install')) {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) {
    console.error('Could not determine home directory to install wallpaper');
    process.exit(1);
  }
  const dest = path.join(home, '.local', 'share', 'plasma', 'wallpapers', meta.KPlugin.Id);
  fs.rmSync(dest, { recursive:true, force:true });
  fs.mkdirSync(dest, { recursive:true });
  fs.cpSync(PKG, dest, { recursive:true });
  console.log(`installed to ${dest}`);
}
