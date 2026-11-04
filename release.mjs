#!/usr/bin/env node
/**
 * 一条命令发版：改版本号 → 跑检查 → npm publish → 等 registry 确认 → 更新市场索引 → 提交推送。
 *
 * 用法：
 *   node release.mjs patch            1.1.0 → 1.1.1
 *   node release.mjs minor            1.1.0 → 1.2.0
 *   node release.mjs major            1.1.0 → 2.0.0
 *   node release.mjs 2.3.1            指定版本
 *   node release.mjs patch --dry-run  只演练，不改文件、不发布、不推送
 *   node release.mjs patch --otp 123456   npm 要求 2FA 时用
 *
 * 为什么需要这个脚本：
 *  1. npm publish 现在可能返回 202（异步受理），版本要等几十秒才真正可见；
 *     脚本会轮询到可见为止，否则会误判失败、重复发布。
 *  2. 包名、cordis.patch.yml 的 name、client.js 的模块 id 必须三处一致，
 *     不一致会导致插件「入口不激活」。发版前强制校验。
 *  3. 市场索引要和 npm 版本一起更新，否则发现页装到的还是旧版本。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = import.meta.dirname;
const PKG_PATH = path.join(ROOT, 'package.json');
const INDEX_PATH = path.join(ROOT, 'market', 'index.json');
const CLIENT_PATH = path.join(ROOT, 'client.js');
const PATCH_PATH = path.join(ROOT, 'cordis.patch.yml');

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const GIT = process.platform === 'win32' ? 'git.exe' : 'git';

// Windows 上直接 spawn npm.cmd 会被 Node 拒绝（EINVAL），改用 npm-cli.js 跑，
// 拿不到就退回 cmd /c，两条路都试过才报错。
const NPM_CLI = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const hasNpmCli = fs.existsSync(NPM_CLI);

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const otpIndex = argv.indexOf('--otp');
const otp = otpIndex >= 0 ? argv[otpIndex + 1] : null;
const bumpArg = argv.find((a, i) => !a.startsWith('--') && (otpIndex < 0 || i !== otpIndex + 1));

// ── 小工具 ────────────────────────────────────────────────────────────────

const say = (msg) => console.log(msg);
const step = (n, total, msg) => console.log(`\n[${n}/${total}] ${msg}`);
const fail = (msg, hint) => {
  console.error(`\n✗ ${msg}`);
  if (hint) console.error(`  ${hint}`);
  process.exit(1);
};

/** 子进程：capture 时把输出写进临时文件（避免管道在受限环境下不可用）。 */
function run(cmd, args, { capture = false, allowFail = false } = {}) {
  const spawnOpts = { cwd: ROOT, ...(capture ? {} : { stdio: 'inherit' }) };
  let fd = null;
  if (capture) {
    const tmp = path.join(os.tmpdir(), `hmm-release-${process.pid}-${Math.random().toString(16).slice(2)}.log`);
    fd = fs.openSync(tmp, 'w');
    spawnOpts.stdio = ['ignore', fd, fd];
    spawnOpts.__tmp = tmp;
  }
  const res = spawnSync(cmd, args, spawnOpts);
  if (capture && fd !== null) {
    fs.closeSync(fd);
    var output = fs.readFileSync(spawnOpts.__tmp, 'utf8');
    fs.rmSync(spawnOpts.__tmp, { force: true });
  }
  if (res.error) fail(`无法执行 ${cmd}：${res.error.message}`);
  const status = res.status ?? 1;
  if (status !== 0 && !allowFail) fail(`${cmd} ${args.join(' ')} 失败（exit ${status}）\n${(output ?? '').trim()}`);
  return { status, output: output ?? '' };
}

/** 跑 npm 命令（Windows 上绕开 npm.cmd 的 EINVAL）。 */
const npm = (args, opts) => (hasNpmCli ? run(process.execPath, [NPM_CLI, ...args], opts) : npm(args, opts));

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');

/** 语义化版本自增。 */
function bumpVersion(current, kind) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/.exec(current);
  if (!m) fail(`当前版本号不是合法的 semver：${current}`);
  const [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  if (kind === 'patch') return `${major}.${minor}.${patch + 1}`;
  if (/^\d+\.\d+\.\d+(?:-.+)?$/.test(kind)) return kind;
  fail(`不认识的目标版本「${kind}」`, '可用：patch / minor / major / 1.2.3');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 这个版本在 registry 上可见吗？ */
function published(version) {
  const res = npm(['view', `${pkgName}@${version}`, 'version'], { capture: true, allowFail: true });
  return res.status === 0 && res.output.includes(version);
}

/** 用 registry 的发布时间当索引时间戳；取不到就用当前时间。 */
function publishTimestamp(version) {
  const res = npm(['view', pkgName, 'time', '--json'], { capture: true, allowFail: true });
  if (res.status === 0) {
    try {
      const stamp = JSON.parse(res.output)[version];
      const ms = Date.parse(stamp);
      if (Number.isFinite(ms)) return Math.floor(ms / 1000);
    } catch { /* 落到下面的兜底 */ }
  }
  return Math.floor(Date.now() / 1000);
}

// ── 0. 读配置 ─────────────────────────────────────────────────────────────

const pkg = readJson(PKG_PATH);
const pkgName = pkg.name;
const current = pkg.version;
if (!bumpArg) fail('缺少目标版本', 'node release.mjs patch | minor | major | 1.2.3');
const next = bumpVersion(current, bumpArg);
const TOTAL = dryRun ? 3 : 7;

say(`\n包名 ${pkgName}    ${current} → ${next}${dryRun ? '   （演练模式，不改任何东西）' : ''}`);

// ── 1. 发版前校验 ─────────────────────────────────────────────────────────

step(1, TOTAL, '发版前校验');

{
  // 包名、cordis 补丁名、客户端模块 id 三处必须一致
  const patch = fs.readFileSync(PATCH_PATH, 'utf8');
  const patchName = /name:\s*'([^']+)'/.exec(patch)?.[1];
  if (patchName !== pkgName) fail(`cordis.patch.yml 的 name 是「${patchName}」，应为「${pkgName}」`);

  const clientHead = fs.readFileSync(CLIENT_PATH, 'utf8').slice(0, 200);
  const clientId = /__ModuleLoader__\.load\(\{id:'([^']+)'/.exec(clientHead)?.[1];
  if (clientId !== pkgName) fail(`client.js 的模块 id 是「${clientId}」，应为「${pkgName}」`, '重新跑一次构建：node build-client.mjs');
  say(`  ✓ 包名 / cordis 补丁 / 客户端 id 一致：${pkgName}`);

  // 已跟踪文件必须干净，否则提交会把无关改动卷进发版 commit
  const status = run(GIT, ['status', '--porcelain', '--untracked-files=no'], { capture: true }).output.trim();
  if (status) fail('工作区不干净，先提交或 stash', status.split('\n').slice(0, 5).join('\n'));
  const untracked = run(GIT, ['ls-files', '--others', '--exclude-standard'], { capture: true }).output.trim();
  if (untracked) say(`  ! 有未跟踪文件（不会进本次提交）：${untracked.split('\n').slice(0, 3).join(', ')}`);

  // npm 登录态
  const who = npm(['whoami'], { capture: true, allowFail: true });
  if (who.status !== 0) fail('npm 未登录', '先跑 npm login，或配置 //registry.npmjs.org/:_authToken');
  say(`  ✓ npm 已登录：${who.output.trim()}`);

  // 目标版本不能已经存在
  if (published(next)) fail(`${pkgName}@${next} 已经发布过了`, '换一个版本号');
  say(`  ✓ ${next} 尚未发布`);
}

// ── 2. 检查与测试 ─────────────────────────────────────────────────────────

step(2, TOTAL, '语法检查 + 引擎测试');
npm(['run', 'check']);
run(process.execPath, ['--import', './tests/register-vendor.mjs', '--test', 'tests/engine.test.mjs']);

if (dryRun) {
  step(3, TOTAL, '演练结束');
  say('  正式发布会依次执行：改版本号 → npm publish → 等 registry 可见 → 更新 market/index.json → commit + push');
  process.exit(0);
}

// ── 3. 改版本号 ───────────────────────────────────────────────────────────

step(3, TOTAL, `版本号 ${current} → ${next}`);
pkg.version = next;
writeJson(PKG_PATH, pkg);

// ── 4. 发布 ───────────────────────────────────────────────────────────────

step(4, TOTAL, 'npm publish');
{
  const args = ['publish'];
  if (otp) args.push('--otp', otp);
  const res = npm(args, { capture: true, allowFail: true });
  if (res.status !== 0) {
    writeJson(PKG_PATH, { ...pkg, version: current }); // 回滚版本号，别留下脏状态
    if (/EOTP|one-time password/i.test(res.output)) {
      fail('npm 要求一次性验证码', `重新跑：node release.mjs ${bumpArg} --otp <当前6位验证码>`);
    }
    if (/E403/i.test(res.output)) fail('npm 拒绝发布（403）', res.output.trim().split('\n').slice(-6).join('\n'));
    fail('发布失败', res.output.trim().split('\n').slice(-6).join('\n'));
  }
  say('  ✓ 已提交发布请求（npm 可能异步处理，稍等确认）');
}

// ── 5. 等 registry 真正可见 ───────────────────────────────────────────────

step(5, TOTAL, '等待 registry 确认新版本');
{
  const deadline = Date.now() + 5 * 60 * 1000;
  let ok = false;
  while (Date.now() < deadline) {
    if (published(next)) { ok = true; break; }
    process.stdout.write('  … 还没出现，10 秒后重试\n');
    await sleep(10_000);
  }
  if (!ok) fail(`${next} 发布后 5 分钟仍不可见`, '去 npmjs.com 看看是不是卡在待审核状态');
  say(`  ✓ ${pkgName}@${next} 已可安装`);
}

// ── 6. 更新市场索引 ───────────────────────────────────────────────────────

step(6, TOTAL, '更新 market/index.json');
{
  const index = readJson(INDEX_PATH);
  const plugin = index.plugins.find((p) => p.name === pkgName);
  if (!plugin) fail(`索引里找不到名为 ${pkgName} 的插件`);
  const engines = plugin.versions[0]?.engines ?? { dsh: pkg.engines?.dsh ?? '>=0.2.1-rc.1' };
  const entry = { version: next, publishTimestamp: publishTimestamp(next), source: { type: 'npm' }, engines };
  // 新版本放最前，最多留 5 个历史版本
  plugin.versions = [entry, ...plugin.versions.filter((v) => v.version !== next)].slice(0, 5);
  writeJson(INDEX_PATH, index);
  say(`  ✓ 索引已指向 ${next}（时间戳 ${entry.publishTimestamp}）`);
}

// ── 7. 提交并推送 ─────────────────────────────────────────────────────────

step(7, TOTAL, '提交并推送');
{
  run(GIT, ['add', 'package.json', 'market/index.json']);
  run(GIT, ['commit', '-m', `release: v${next}`]);

  // 这台机器上 git 走代理偶尔握手失败，直连偶尔连不上，两种都试一遍
  let pushed = false;
  for (let attempt = 1; attempt <= 4 && !pushed; attempt++) {
    const args = attempt % 2 === 1 ? ['-c', 'http.proxy=', '-c', 'https.proxy=', 'push', 'origin', 'main'] : ['push', 'origin', 'main'];
    const res = run(GIT, args, { capture: true, allowFail: true });
    pushed = res.status === 0;
    if (!pushed) {
      say(`  第 ${attempt} 次推送失败（${attempt % 2 === 1 ? '直连' : '代理'}），重试…`);
      await sleep(3000);
    }
  }
  if (!pushed) {
    say('  ! 推送失败，但版本已经发布、索引已在本地更新');
    say('    网络恢复后手动执行：git push origin main');
    process.exit(2);
  }
  say('  ✓ 已推送');
}

say(`\n完成：${pkgName}@${next}`);
say(`  npm     https://www.npmjs.com/package/${pkgName}/v/${next}`);
say(`  市场索引 https://raw.githubusercontent.com/Xiuxiu-6/harnessmm-dsh/main/market/index.json`);
say(`\n别人现在在「添加插件」里填 ${pkgName} 装到的就是 ${next}。`);
