#!/usr/bin/env node
// Install lean-ctx without piping a remote script into bash.
//
// The upstream installer is a shell script, so it cannot run on Windows even
// though lean-ctx ships Windows binaries. This does the same job in Node:
// resolve the release, pick the asset for this platform, download it, check it
// against the published SHA256SUMS, and unpack it to ~/.local/bin.
//
// The checksum is the part the pipe never did. `curl | bash` runs whatever the
// server sends; this refuses anything whose hash does not match the manifest.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync,
  existsSync, renameSync, chmodSync, readdirSync,
} from 'node:fs';
import { tmpdir, homedir, platform, arch } from 'node:os';
import { join } from 'node:path';

const REPO = 'yvgude/lean-ctx';
const INSTALL_DIR = join(homedir(), '.local', 'bin');

// Matches the asset naming in the project's releases.
const TARGETS = {
  'darwin-arm64': 'aarch64-apple-darwin.tar.gz',
  'darwin-x64': 'x86_64-apple-darwin.tar.gz',
  'linux-arm64': 'aarch64-unknown-linux-gnu.tar.gz',
  'linux-x64': 'x86_64-unknown-linux-gnu.tar.gz',
  // Alpine and other musl distributions report plain linux-x64 to Node, but a
  // glibc binary dies there with a loader error that names nothing useful.
  'linux-arm64-musl': 'aarch64-unknown-linux-musl.tar.gz',
  'linux-x64-musl': 'x86_64-unknown-linux-musl.tar.gz',
  'win32-x64': 'x86_64-pc-windows-msvc.zip',
  // Windows on ARM runs x64 binaries under emulation, and no arm64 build is
  // published, so this is the working choice rather than a failure.
  'win32-arm64': 'x86_64-pc-windows-msvc.zip',
};

/**
 * Which build this machine needs.
 *
 * Node reports the same linux-x64 on Alpine as on Debian. The difference shows
 * in the process report: a glibc runtime version is present on glibc and
 * missing on musl, which is the only reliable check without shelling out.
 */
export function resolveTarget(plat = platform(), cpu = arch(), musl = detectMusl(plat)) {
  const base = `${plat}-${cpu}`;
  if (plat === 'linux' && musl && TARGETS[`${base}-musl`]) return `${base}-musl`;
  return base;
}

export function detectMusl(plat = platform()) {
  if (plat !== 'linux') return false;
  try {
    return !process.report?.getReport?.()?.header?.glibcVersionRuntime;
  } catch {
    return false;
  }
}

export async function installLeanCtx({ log = console.log } = {}) {
  const key = resolveTarget();
  const suffix = TARGETS[key];
  if (!suffix) {
    throw new Error(`no lean-ctx build for ${key}. Supported: ${Object.keys(TARGETS).join(', ')}`);
  }

  const rel = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`releases API ${r.status}`))));
  const version = String(rel.tag_name).replace(/^v/, '');
  const assetName = `lean-ctx-${suffix}`;
  const asset = rel.assets.find((a) => a.name === assetName);
  const sums = rel.assets.find((a) => a.name === 'SHA256SUMS');
  if (!asset) throw new Error(`release ${rel.tag_name} has no ${assetName}`);

  log(`      lean-ctx ${version} for ${key}`);
  const tmp = mkdtempSync(join(tmpdir(), 'leanctx-'));
  try {
    const buf = Buffer.from(await fetch(asset.browser_download_url).then((r) => {
      if (!r.ok) throw new Error(`download ${r.status}`);
      return r.arrayBuffer();
    }));

    // Verify before unpacking anything.
    if (sums) {
      const manifest = await fetch(sums.browser_download_url).then((r) => (r.ok ? r.text() : ''));
      const want = manifest.split('\n')
        .map((l) => l.trim().split(/\s+/))
        .find(([, name]) => name?.replace(/^\*/, '') === assetName)?.[0];
      const got = createHash('sha256').update(buf).digest('hex');
      if (want && want !== got) throw new Error(`checksum mismatch: expected ${want}, got ${got}`);
      log(want ? '      checksum ok' : '      no checksum listed for this asset');
    }

    const archive = join(tmp, assetName);
    writeFileSync(archive, buf);
    // bsdtar ships with macOS, most Linux, and Windows 10+, and reads zip too.
    try {
      execFileSync('tar', ['-xf', archive, '-C', tmp], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      // Windows before 10/1803 has no bsdtar. PowerShell can unpack a zip.
      if (platform() === 'win32' && archive.endsWith('.zip')) {
        execFileSync('powershell', ['-NoProfile', '-Command',
          `Expand-Archive -LiteralPath '${archive}' -DestinationPath '${tmp}' -Force`],
          { stdio: ['ignore', 'pipe', 'pipe'] });
      } else throw err;
    }

    const binName = platform() === 'win32' ? 'lean-ctx.exe' : 'lean-ctx';
    const found = findBinary(tmp, binName);
    if (!found) throw new Error(`no ${binName} inside ${assetName}`);

    mkdirSync(INSTALL_DIR, { recursive: true });
    const dest = join(INSTALL_DIR, binName);
    renameSync(found, dest);
    if (platform() !== 'win32') chmodSync(dest, 0o755);
    log(`      installed to ${dest.replace(homedir(), '~')}`);
    return dest;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function findBinary(dir, name, depth = 0) {
  if (depth > 4) return null;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      const hit = findBinary(p, name, depth + 1);
      if (hit) return hit;
    } else if (e.name === name) return p;
  }
  return null;
}

// Runnable on its own, and importable by the onboarder.
if (import.meta.url === `file://${process.argv[1]}`) {
  installLeanCtx().then(
    () => process.exit(0),
    (e) => { console.error('lean-ctx:', e.message); process.exit(1); },
  );
}
