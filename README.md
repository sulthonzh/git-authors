# git-authors

Code ownership analysis for git repos — who owns what, how much, and how it changed.

Ever wondered who *actually* owns that module? Not just who touched it last, but who wrote most of the lines? `git-authors` uses `git blame` under the hood to tell you exactly that.

## What it does

- **Author ownership ranking** — see who owns what percentage of the codebase based on actual line attribution
- **File-level ownership** — which author dominates each file
- **Author detail** — deep dive into a single contributor's footprint
- **Date range filtering** — analyze ownership over a specific period
- **Extension/path filtering** — focus on `.ts` files, exclude `vendor/`, etc.

## Install

```bash
npm install -g git-authors
```

## Usage

### Summary (default)

```bash
git-authors                  # analyze current directory
git-authors /path/to/repo    # analyze another repo
```

Output:
```
Code Ownership: my-project (main)
247 commits · 42 files · 3891 lines

Author                   Commits   Lines   Files  Own%   Active  First       Last
──────────────────────────────────────────────────────────────────────────────────────
Alice Smith                142    2104      28  54.1%    89d  2024-01-15  2025-05-20
Bob Jones                   85    1342      22  34.5%    61d  2024-02-10  2025-05-18
Charlie Park                20     445       8  11.4%    14d  2024-06-01  2025-04-30
```

### File ownership

```bash
git-authors files                # which author dominates each file
git-authors files --top 10       # top 10 files
```

### Author detail

```bash
git-authors detail alice@example.com
```

### Filter by date, extension, path

```bash
git-authors --since="2024-01-01" --until="2024-12-31"
git-authors --ext .ts,.tsx --exclude "src/generated,vendor"
git-authors files --ext .py
```

### Output formats

```bash
git-authors --json          # JSON for scripting/CI
git-authors --markdown      # Markdown table for docs
```

## Why not just `git shortlog`?

`git shortlog` tells you commit counts. But commits are a terrible proxy for ownership — one person's "fix typo" commit counts the same as another's "rewrite auth module." `git-authors` looks at actual line attribution via `git blame` to tell you who *wrote* the code, not just who pushed buttons.

## API

```typescript
import { analyze, getAuthorDetail, formatTable } from "git-authors";

const result = analyze("/path/to/repo", {
  since: "2024-01-01",
  extensions: [".ts", ".tsx"],
  excludePaths: ["src/generated"],
});

console.log(formatTable(result));

// Deep dive on one author
const detail = getAuthorDetail(result, "alice@example.com");
console.log(detail.topFiles);  // files they own, sorted by lines
```

## How it works

1. **`git shortlog -sne`** — commit counts per author
2. **`git log --numstat`** — insertions/deletions per author
3. **`git blame --line-porcelain`** — line-level attribution per file
4. Dominant author per file = who wrote the most lines
5. Ownership % = author's blamed lines / total lines across all files

## Options

| Flag | Description |
|------|-------------|
| `--since <date>` | Only count commits after date |
| `--until <date>` | Only count commits before date |
| `--author <pattern>` | Filter to matching author |
| `--ext <ext>` | Only include these extensions (comma-separated) |
| `--exclude <path>` | Exclude paths (comma-separated) |
| `--top <n>` | Show top N results (default: 20) |
| `--json` | JSON output |
| `--markdown` | Markdown table output |

## Zero dependencies

No runtime deps. Just Node.js 18+ and git.

## License

MIT
