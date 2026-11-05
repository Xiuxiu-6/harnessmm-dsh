/**
 * 把测试需要的 harness 内部包从本机 DSH 的 app.asar 里取出来，放进
 * `.vendor-tools/node_modules/@deepseek-ai/`。
 *
 * 为什么需要这一步：`index.js` 的 `Config` 是 Schemastery schema，而
 * `@deepseek-ai/schemastery` 是 harness 内部包、不在公共 npm 上，运行时由宿主
 * 自己的模块树解析。裸 Node 测试进程没有那棵树，所以 `tests/host.test.mjs`
 * 一 import `index.js` 就会 MODULE_NOT_FOUND。
 *
 * 用法：
 *   node scripts/vendor-harness-peer.mjs                 # 自动找 asar
 *   node scripts/vendor-harness-peer.mjs --asar <path>   # 指定 asar
 *   node scripts/vendor-harness-peer.mjs --if-missing    # 已存在就跳过（pretest 用）
 *   DSH_ASAR=<path> node scripts/vendor-harness-peer.mjs # 环境变量指定
 *
 * ASAR 布局（Electron）：[4][pickleSize][innerSize][jsonSize][header JSON][data...]，
 * 数据区起点 = 8 + pickleSize，每个 entry 的 offset 相对这个起点。
 */
import { openSync, readSync, closeSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const vendorRoot = path.join(repoRoot, '.vendor-tools', 'node_modules', '@deepseek-ai');

/** 要取出来的包（相对 asar 内的 dsh/node_modules/@deepseek-ai/）。 */
const PACKAGES = ['schemastery', 'cosmokit'];

/** asar 里可能的前缀：desktop 版把依赖放在 dsh/ 下，也见过平铺在根上的。 */
const PREFIXES = ['dsh/node_modules/@deepseek-ai/', 'node_modules/@deepseek-ai/'];

function parseArgs(argv) {
  const out = { asar: process.env.DSH_ASAR ?? null, ifMissing: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--asar') out.asar = argv[++i] ?? null;
    else if (argv[i] === '--if-missing') out.ifMissing = true;
  }
  return out;
}

/** 常见安装位置，找不到就返回 null（让调用方给出明确报错）。 */
function guessAsar() {
  const candidates = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'DeepSeek Harness', 'resources', 'app.asar'),
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'DeepSeek Harness', 'resources', 'app.asar'),
    'D:/Application list/Deepseek-Harness/resources/app.asar',
  ].filter(Boolean);
  return candidates.find((item) => existsSync(item)) ?? null;
}

/** 读 asar 头，返回 { baseOffset, entries }。 */
function readAsarIndex(asarPath) {
  const fd = openSync(asarPath, 'r');
  try {
    const head = Buffer.alloc(16);
    readSync(fd, head, 0, 16, 0);
    const pickleSize = head.readUInt32LE(4);
    const jsonSize = head.readUInt32LE(12);
    const headerBuf = Buffer.alloc(jsonSize);
    readSync(fd, headerBuf, 0, jsonSize, 16);
    const header = JSON.parse(headerBuf.toString('utf8'));

    const entries = [];
    const walk = (node, prefix) => {
      for (const [name, value] of Object.entries(node.files ?? {})) {
        const full = prefix ? `${prefix}/${name}` : name;
        if (value.files) walk(value, full);
        else entries.push({ path: full, size: value.size ?? 0, offset: value.offset ? Number(value.offset) : 0 });
      }
    };
    walk(header, '');
    return { fd, baseOffset: 8 + pickleSize, entries };
  } catch (error) {
    closeSync(fd);
    throw error;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const already = PACKAGES.every((name) => existsSync(path.join(vendorRoot, name)));
  if (args.ifMissing && already) {
    console.log('[vendor] 已存在，跳过');
    return;
  }

  const asarPath = args.asar ?? guessAsar();
  if (!asarPath || !existsSync(asarPath)) {
    console.error('[vendor] 找不到 app.asar。请用 --asar <path> 或 DSH_ASAR=<path> 指定，');
    console.error('[vendor] 例如：node scripts/vendor-harness-peer.mjs --asar "D:/.../resources/app.asar"');
    process.exitCode = 1;
    return;
  }

  const { fd, baseOffset, entries } = readAsarIndex(asarPath);
  try {
    let written = 0;
    for (const pkg of PACKAGES) {
      const prefix = PREFIXES.map((p) => `${p}${pkg}/`).find((p) => entries.some((e) => e.path.startsWith(p)));
      if (!prefix) {
        console.error(`[vendor] asar 里找不到 ${pkg}`);
        process.exitCode = 1;
        return;
      }
      for (const entry of entries) {
        if (!entry.path.startsWith(prefix)) continue;
        const relative = entry.path.slice(prefix.length);
        const dest = path.join(vendorRoot, pkg, relative);
        const buf = Buffer.alloc(entry.size);
        readSync(fd, buf, 0, entry.size, baseOffset + entry.offset);
        mkdirSync(path.dirname(dest), { recursive: true });
        writeFileSync(dest, buf);
        written += 1;
      }
    }
    console.log(`[vendor] 从 ${asarPath} 取出 ${written} 个文件 -> ${vendorRoot}`);
  } finally {
    closeSync(fd);
  }
}

main();
