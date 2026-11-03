# Why this directory is vendored

`Config` in `index.js` is a Schemastery schema, because the harness Loader
validates a plugin's `Config` through `Config['~standard'].validate(config)` and a
plain JSON Schema object has no such member.

`@deepseek-ai/schemastery` is a harness-internal package: it ships inside the
DeepSeek Harness installation, not on the public npm registry. It is therefore
**not** a dependency of this plugin. At runtime the Host resolves it from its own
module tree, which is why `package.json` declares it only as an *optional* peer
dependency.

`tests/host.test.mjs` imports `index.js`, though, and a bare Node process has no
harness module tree to resolve against. The two `test` scripts therefore run Node
with `--experimental-loader ./tests/resolve-harness-peer.mjs`, which resolves this
single bare specifier from this directory and defers every other specifier to the
default resolver.

The vendored copy is the unmodified `@deepseek-ai/schemastery@3.18.5` (MIT, with
`@deepseek-ai/cosmokit`), extracted verbatim from the installed harness. It is
used only by tests. If the harness later exposes this package differently, delete
this directory and change the test command to install it explicitly.
