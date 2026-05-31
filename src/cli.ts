#!/usr/bin/env node

import {
  analyze,
  getAuthorDetail,
  formatTable,
  formatFiles,
  formatJSON,
  formatMarkdown,
  AnalysisOptions,
} from "./index";

const args = process.argv.slice(2);

function help(): never {
  console.log(`git-authors — code ownership analysis for git repos

Usage:
  git-authors [path]           Show author ownership summary
  git-authors files [path]     Show file-level ownership
  git-authors detail <email>   Show detailed stats for one author

Options:
  --since <date>     Only count commits after date
  --until <date>     Only count commits before date
  --author <pattern> Filter to author name/email
  --ext <ext>        Only include these file extensions (comma-separated)
  --exclude <path>   Exclude paths (comma-separated)
  --top <n>          Show top N results (default: 20)
  --json             JSON output
  --markdown         Markdown output
  -h, --help         Show this help

Examples:
  git-authors                          # overview for current repo
  git-authors --since="2024-01-01"     # this year only
  git-authors --ext .ts,.tsx           # TypeScript files only
  git-authors files --top 10           # top 10 files by ownership
  git-authors detail user@example.com  # deep dive on one author`);
  process.exit(0);
}

if (args.includes("-h") || args.includes("--help")) help();

// Parse args
let command = "summary";
let repoPath = ".";
const opts: AnalysisOptions = {};
let top = 20;
let jsonOut = false;
let mdOut = false;
let detailEmail = "";

const positional: string[] = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  switch (arg) {
    case "files":
      command = "files";
      break;
    case "detail":
      command = "detail";
      detailEmail = args[++i] || "";
      break;
    case "--since":
      opts.since = args[++i];
      break;
    case "--until":
      opts.until = args[++i];
      break;
    case "--author":
      opts.author = args[++i];
      break;
    case "--ext":
      opts.extensions = args[++i]?.split(",").map((e) => e.trim());
      break;
    case "--exclude":
      opts.excludePaths = args[++i]?.split(",").map((e) => e.trim());
      break;
    case "--top":
      top = parseInt(args[++i], 10) || 20;
      break;
    case "--json":
      jsonOut = true;
      break;
    case "--markdown":
      mdOut = true;
      break;
    default:
      if (!arg.startsWith("-")) positional.push(arg);
      break;
  }
}

if (positional[0]) repoPath = positional[0];

try {
  const result = analyze(repoPath, opts);

  if (command === "detail") {
    if (!detailEmail) {
      console.error("Usage: git-authors detail <email>");
      process.exit(1);
    }
    const detail = getAuthorDetail(result, detailEmail);
    if (!detail) {
      console.error(`Author not found: ${detailEmail}`);
      process.exit(1);
    }
    console.log(jsonOut ? formatJSON(detail) : formatJSON(detail));
    process.exit(0);
  }

  if (command === "files") {
    if (jsonOut) {
      console.log(formatJSON(result.fileOwnership.slice(0, top)));
    } else {
      console.log(formatFiles(result.fileOwnership, top));
    }
    process.exit(0);
  }

  // Summary
  if (jsonOut) {
    const output = {
      repo: result.repo,
      branch: result.branch,
      totalCommits: result.totalCommits,
      totalFiles: result.totalFiles,
      totalLines: result.totalLines,
      authors: result.authors.slice(0, top),
    };
    console.log(formatJSON(output));
  } else if (mdOut) {
    console.log(formatMarkdown(result, top));
  } else {
    console.log(formatTable(result, top));
  }
} catch (e: any) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
