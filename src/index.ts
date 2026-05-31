import { execSync } from "child_process";
import path from "path";
import fs from "fs";

// --- Types ---

export interface AuthorStats {
  name: string;
  email: string;
  commits: number;
  insertions: number;
  deletions: number;
  filesOwned: number;
  linesOwned: number;
  ownershipPercent: number;
  activeDays: number;
  firstCommit: string;
  lastCommit: string;
}

export interface FileOwnership {
  file: string;
  author: string;
  email: string;
  lines: number;
  totalLines: number;
  percent: number;
}

export interface AuthorFileDetail {
  file: string;
  lines: number;
  totalLines: number;
  percent: number;
}

export interface AuthorDetail {
  stats: AuthorStats;
  topFiles: AuthorFileDetail[];
}

export interface AnalysisResult {
  repo: string;
  branch: string;
  totalFiles: number;
  totalLines: number;
  totalCommits: number;
  authors: AuthorStats[];
  fileOwnership: FileOwnership[];
}

export interface AnalysisOptions {
  repoPath?: string;
  branch?: string;
  since?: string;
  until?: string;
  author?: string;
  extensions?: string[];
  excludePaths?: string[];
  top?: number;
}

// --- Helpers ---

function git(args: string, cwd: string): string {
  try {
    return execSync(`git ${args}`, { cwd, encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 }).trim();
  } catch (e: any) {
    if (e.status === 128) return "";
    throw e;
  }
}

function parseLogLine(line: string): { name: string; email: string } | null {
  // Format: "Name <email>"
  const match = line.match(/^(.+?)\s*<(.+?)>$/);
  if (!match) return null;
  return { name: match[1].trim(), email: match[2].trim() };
}

function matchesExtension(file: string, extensions?: string[]): boolean {
  if (!extensions || extensions.length === 0) return true;
  return extensions.some((ext) => file.endsWith(ext.startsWith(".") ? ext : "." + ext));
}

function isExcluded(file: string, excludePaths?: string[]): boolean {
  if (!excludePaths || excludePaths.length === 0) return false;
  return excludePaths.some((p) => file.startsWith(p));
}

// --- Core ---

export function getAuthorCommitStats(repoPath: string, opts: AnalysisOptions): AuthorStats[] {
  const rangeArgs: string[] = [];
  if (opts.since) rangeArgs.push(`--since="${opts.since}"`);
  if (opts.until) rangeArgs.push(`--until="${opts.until}"`);
  if (opts.author) rangeArgs.push(`--author=${opts.author}`);

  // Shortlog for commit counts
  const shortlog = git(
    `shortlog -sne ${rangeArgs.join(" ")} HEAD`,
    repoPath
  );
  const authorMap = new Map<string, AuthorStats>();

  for (const line of shortlog.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Format: "  123  Name <email>"
    const match = trimmed.match(/^(\d+)\s+(.+)$/);
    if (!match) continue;
    const commits = parseInt(match[1], 10);
    const parsed = parseLogLine(match[2]);
    if (!parsed) continue;

    const key = parsed.email;
    authorMap.set(key, {
      name: parsed.name,
      email: parsed.email,
      commits,
      insertions: 0,
      deletions: 0,
      filesOwned: 0,
      linesOwned: 0,
      ownershipPercent: 0,
      activeDays: 0,
      firstCommit: "",
      lastCommit: "",
    });
  }

  // Get insertions/deletions per author
  const numstat = git(
    `log ${rangeArgs.join(" ")} --format="%ae" --numstat HEAD`,
    repoPath
  );
  let currentEmail = "";
  for (const line of numstat.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!trimmed.includes("\t")) {
      // This is an email line
      currentEmail = trimmed;
      continue;
    }
    const parts = trimmed.split("\t");
    if (parts.length < 3) continue;
    const ins = parts[0] === "-" ? 0 : parseInt(parts[0], 10) || 0;
    const del = parts[1] === "-" ? 0 : parseInt(parts[1], 10) || 0;
    const file = parts[2];

    if (!matchesExtension(file, opts.extensions)) continue;
    if (isExcluded(file, opts.excludePaths)) continue;

    const stats = authorMap.get(currentEmail);
    if (stats) {
      stats.insertions += ins;
      stats.deletions += del;
    }
  }

  // Get first/last commit dates and active days per author
  for (const [email, stats] of authorMap) {
    const dates = git(
      `log ${rangeArgs.join(" ")} --author="${email}" --format="%ad" --date=short HEAD`,
      repoPath
    );
    if (dates) {
      const uniqueDays = new Set(dates.split("\n").map((d) => d.trim()).filter(Boolean));
      stats.activeDays = uniqueDays.size;
      const sorted = [...uniqueDays].sort();
      stats.firstCommit = sorted[0];
      stats.lastCommit = sorted[sorted.length - 1];
    }
  }

  return [...authorMap.values()].sort((a, b) => b.commits - a.commits);
}

export function getFileOwnership(repoPath: string, opts: AnalysisOptions): FileOwnership[] {
  // Get list of tracked files
  let files = git("ls-files", repoPath).split("\n").filter(Boolean);

  files = files.filter((f) => matchesExtension(f, opts.extensions) && !isExcluded(f, opts.excludePaths));

  const results: FileOwnership[] = [];

  for (const file of files) {
    try {
      const blame = git(`blame --line-porcelain HEAD -- "${file}"`, repoPath);
      if (!blame) continue;

      const authorLines = new Map<string, { name: string; lines: number }>();
      let totalLines = 0;
      let currentAuthor = "";
      let currentMail = "";

      for (const line of blame.split("\n")) {
        if (line.startsWith("author-mail ")) {
          const match = line.match(/<(.+?)>/);
          currentMail = match ? match[1] : "";
        } else if (line.startsWith("author ")) {
          currentAuthor = line.substring(7);
        } else if (line.startsWith("\t")) {
          totalLines++;
          const key = currentMail;
          const existing = authorLines.get(key);
          if (existing) {
            existing.lines++;
          } else {
            authorLines.set(key, { name: currentAuthor, lines: 1 });
          }
        }
      }

      // Find dominant author
      let dominant = "";
      let dominantName = "";
      let dominantLines = 0;
      for (const [email, data] of authorLines) {
        if (data.lines > dominantLines) {
          dominantLines = data.lines;
          dominant = email;
          dominantName = data.name;
        }
      }

      if (dominant && totalLines > 0) {
        results.push({
          file,
          author: dominantName,
          email: dominant,
          lines: dominantLines,
          totalLines,
          percent: Math.round((dominantLines / totalLines) * 1000) / 10,
        });
      }
    } catch {
      // Skip binary or unreadable files
    }
  }

  return results.sort((a, b) => b.percent - a.percent);
}

export function analyze(repoPath?: string, options: AnalysisOptions = {}): AnalysisResult {
  const repo = repoPath || process.cwd();
  const branch = options.branch || git("rev-parse --abbrev-ref HEAD", repo) || "HEAD";

  const opts: AnalysisOptions = {
    ...options,
    repoPath: repo,
  };

  const authors = getAuthorCommitStats(repo, opts);
  const fileOwnership = getFileOwnership(repo, opts);

  // Calculate ownership per author
  const totalLines = fileOwnership.reduce((sum, f) => sum + f.totalLines, 0);
  for (const author of authors) {
    const owned = fileOwnership.filter((f) => f.email === author.email);
    author.filesOwned = owned.length;
    author.linesOwned = owned.reduce((sum, f) => sum + f.lines, 0);
    author.ownershipPercent = totalLines > 0
      ? Math.round((author.linesOwned / totalLines) * 1000) / 10
      : 0;
  }

  // Re-sort by ownership
  authors.sort((a, b) => b.ownershipPercent - a.ownershipPercent);

  const totalCommits = git("rev-list --count HEAD", repo);
  const totalFiles = fileOwnership.length;

  return {
    repo: path.basename(repo),
    branch,
    totalFiles,
    totalLines,
    totalCommits: parseInt(totalCommits, 10) || 0,
    authors,
    fileOwnership,
  };
}

export function getAuthorDetail(result: AnalysisResult, email: string): AuthorDetail | null {
  const stats = result.authors.find((a) => a.email === email);
  if (!stats) return null;

  const topFiles = result.fileOwnership
    .filter((f) => f.email === email)
    .sort((a, b) => b.lines - a.lines)
    .map((f) => ({
      file: f.file,
      lines: f.lines,
      totalLines: f.totalLines,
      percent: f.percent,
    }));

  return { stats, topFiles };
}

// --- Output Formatters ---

export function formatTable(result: AnalysisResult, top?: number): string {
  const limit = top || result.authors.length;
  const authors = result.authors.slice(0, limit);

  const lines: string[] = [
    `Code Ownership: ${result.repo} (${result.branch})`,
    `${result.totalCommits} commits · ${result.totalFiles} files · ${result.totalLines} lines`,
    "",
    "Author                   Commits   Lines   Files  Own%   Active  First       Last",
    "─".repeat(90),
  ];

  for (const a of authors) {
    const name = a.name.length > 22 ? a.name.substring(0, 20) + ".." : a.name.padEnd(22);
    const first = a.firstCommit || "n/a";
    const last = a.lastCommit || "n/a";
    lines.push(
      `${name}  ${String(a.commits).padStart(7)}  ${String(a.linesOwned).padStart(6)}  ${String(a.filesOwned).padStart(5)}  ${String(a.ownershipPercent).padStart(4)}%  ${String(a.activeDays).padStart(5)}d  ${first}  ${last}`
    );
  }

  return lines.join("\n");
}

export function formatFiles(fileOwnership: FileOwnership[], top?: number): string {
  const files = fileOwnership.slice(0, top || fileOwnership.length);

  const lines: string[] = [
    "File Ownership (dominant author)",
    "",
    "Author                   File                                Lines  Total   %",
    "─".repeat(85),
  ];

  for (const f of files) {
    const author = f.author.length > 22 ? f.author.substring(0, 20) + ".." : f.author.padEnd(22);
    const file = f.file.length > 34 ? f.file.substring(0, 32) + ".." : f.file.padEnd(34);
    lines.push(`${author}  ${file}  ${String(f.lines).padStart(5)}  ${String(f.totalLines).padStart(5)}  ${String(f.percent).padStart(4)}%`);
  }

  return lines.join("\n");
}

export function formatJSON(data: any): string {
  return JSON.stringify(data, null, 2);
}

export function formatMarkdown(result: AnalysisResult, top?: number): string {
  const limit = top || result.authors.length;
  const authors = result.authors.slice(0, limit);

  const lines: string[] = [
    `# Code Ownership: ${result.repo}`,
    "",
    `**Branch:** ${result.branch} · **Commits:** ${result.totalCommits} · **Files:** ${result.totalFiles} · **Lines:** ${result.totalLines}`,
    "",
    "| Author | Commits | Lines Owned | Files | Ownership | Active Days |",
    "|--------|---------|-------------|-------|-----------|-------------|",
  ];

  for (const a of authors) {
    lines.push(`| ${a.name} | ${a.commits} | ${a.linesOwned} | ${a.filesOwned} | ${a.ownershipPercent}% | ${a.activeDays}d |`);
  }

  return lines.join("\n");
}
