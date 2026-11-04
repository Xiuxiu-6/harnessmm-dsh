/**
 * 把 client-src.js 打成宿主可加载的 client.js。
 *
 * 宿主契约（从 dsh-context@0.78.2 的 lib/client.js 反推）：
 *   window.__ModuleLoader__.load({ id, factory })
 *   factory(require) 返回 { name, inject, apply }
 *
 * 两个必须踩准的点：
 *   1. id 必须等于包名（这里从 package.json 读，改名不用手改脚本），否则
 *      bundle 注册的工厂名与加载器登记的包名不一致 → "duplicate factory
 *      registration" / 入口不激活。
 *   2. 工厂参数是 require，不是 ctx。
 */
import { rolldown } from 'rolldown';
import fs from 'node:fs';
import path from 'node:path';

const HERE = import.meta.dirname;
const OUT = path.join(HERE, 'client.js');
const ID = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8')).name;
if (typeof ID !== 'string' || ID === '') throw new Error('package.json 里没有 name');

const bundle = await rolldown({
  input: path.join(HERE, 'client-src.js'),
  platform: 'browser',
  resolve: { extensions: ['.js', '.jsx', '.mjs', '.json'] },
});

const generated = await bundle.generate({ format: 'iife', name: 'HarnessMMClient', sourcemap: false });

let code = '';
for (const chunk of generated.output) {
  if (chunk.type === 'chunk') code += chunk.code;
}

const wrapped = `/* HarnessMM 面板客户端 —— 由 build-client.mjs 生成，勿手改 */
window.__ModuleLoader__.load({id:'${ID}',factory:function(require){
var __hmmRequire = typeof require === 'function' ? require : null;
${code}
var m = HarnessMMClient;
return { name: m.name, inject: m.inject, apply: m.apply };
}});
`;
fs.writeFileSync(OUT, wrapped, 'utf8');
console.log('built ->', OUT);
console.log('bytes:', wrapped.length);
