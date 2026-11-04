# Plugin market index

`index.json` is a [format-1 plugin market index](https://github.com/Xiuxiu-6/harnessmm-dsh/blob/main/market/index.json)
for DSH's **Discover** tab. It lists `dsh-plugin-harnessmm` and installs it
straight from this repository, pinned to a commit.

## Add it

1. Open **Plugins** in the Web sidebar.
2. Turn on **More → Experimental plugins → Custom plugin markets**
   (the Discover tab only exists while that bundle is on; DSH ships no official
   market, so the tab is empty until you add a source).
3. Open **Discover → Add index source** and paste:

   ```
   https://raw.githubusercontent.com/Xiuxiu-6/harnessmm-dsh/main/market/index.json
   ```

4. Search **`harnessmm`** and install.

## What search matches

The Discover search compares every word against the package name, the author,
the keywords, and the title, description, category and label titles in every
language the index declares. For this index, any of these find the plugin:

| Query | Matches through |
|---|---|
| `harnessmm` | package name `dsh-plugin-harnessmm`, keyword `harnessmm` |
| `decision reuse` / `决策复用` | keyword + label + title |
| `Xiuxiu-6` | author |
| `panel` / `面板` | label + description |
| `省 token` / `token efficiency` | keyword |

## Bumping a version

Each release needs a new entry under `plugins[0].versions` with the exact SemVer,
an integer `publishTimestamp` in Unix **seconds**, and a `source`:

- `{"type":"git","url":"https://github.com/Xiuxiu-6/harnessmm-dsh","commit":"<40-hex>"}`
  — installs `git+https://…git#<commit>`; no npm publishing needed.
- `{"type":"npm"}` — only once the package is actually on the registry.

Validate before committing: the index is accepted only if DSH's own
`parseMarketIndex` from `@deepseek-ai/dsh-plugin-market-index` returns a document
(field names, `title` with an `en` member, 40-hex commit, canonical `https` URLs).
