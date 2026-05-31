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
export declare function getAuthorCommitStats(repoPath: string, opts: AnalysisOptions): AuthorStats[];
export declare function getFileOwnership(repoPath: string, opts: AnalysisOptions): FileOwnership[];
export declare function analyze(repoPath?: string, options?: AnalysisOptions): AnalysisResult;
export declare function getAuthorDetail(result: AnalysisResult, email: string): AuthorDetail | null;
export declare function formatTable(result: AnalysisResult, top?: number): string;
export declare function formatFiles(fileOwnership: FileOwnership[], top?: number): string;
export declare function formatJSON(data: any): string;
export declare function formatMarkdown(result: AnalysisResult, top?: number): string;
