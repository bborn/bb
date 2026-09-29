// FORK-ONLY (bborn/bb): find the thread behind a GitHub PR or a Linear issue.
//
// Paste a PR URL, `owner/repo#123`, a Linear URL, or `ENG-482` into thread
// search and the threads that did the work come first: the one on the PR's
// head branch, the one whose branch or title carries the ticket key. bb's
// full-text search cannot find these on its own. It never reads branch names,
// and it splits "OL-3782" into the words "ol" and "3782".
//
// Kept to this one file plus a single call in routes/threads/base.ts, so the
// nightly rebase onto upstream has almost nothing to merge.
import { execFile } from "node:child_process";
import {
  getProject,
  listThreadsWithPendingInteractionState,
  type ThreadSearchResultGroup,
  type ThreadWithPendingInteractionState,
} from "@bb/db";
import type { AppDeps } from "../../types.js";

export type ThreadRef =
  | { kind: "pr"; owner: string; repo: string; number: number }
  | { kind: "linear"; key: string };

type ThreadSearchResult = ThreadSearchResultGroup["results"][number];
type ThreadSearchMatch = ThreadSearchResult["matches"][number];

export interface ThreadSearchGroups {
  active: ThreadSearchResultGroup;
  archived: ThreadSearchResultGroup;
}

export interface RefMatch {
  thread: ThreadWithPendingInteractionState;
  reason: string;
}

const PR_URL = /github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/i;
const PR_SHORT = /^([\w.-]+)\/([\w.-]+)#(\d+)$/;
const LINEAR_URL = /linear\.app\/[\w-]+\/issue\/([a-z][a-z0-9]*-\d+)/i;
// A letter first keeps dates and version ranges from reading as tickets.
const LINEAR_KEY = /^[a-z][a-z0-9]{0,9}-\d+$/i;
// Every thread in a checkout shares these; a PR from one names no thread.
const SHARED_BRANCHES = new Set([
  "main",
  "master",
  "develop",
  "trunk",
  "staging",
  "production",
]);

export function parseThreadRef(raw: string): ThreadRef | null {
  const text = raw.trim();
  const pr = PR_URL.exec(text) ?? PR_SHORT.exec(text);
  // The owner and repo go into a GitHub API path; "." or ".." would walk it.
  if (pr !== null && !/^\.+$/.test(pr[1]!) && !/^\.+$/.test(pr[2]!)) {
    return {
      kind: "pr",
      owner: pr[1]!.toLowerCase(),
      repo: pr[2]!.toLowerCase(),
      number: Number.parseInt(pr[3]!, 10),
    };
  }
  const linear = LINEAR_URL.exec(text);
  if (linear !== null) return { kind: "linear", key: linear[1]!.toUpperCase() };
  if (LINEAR_KEY.test(text)) return { kind: "linear", key: text.toUpperCase() };
  return null;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The key as a whole token, so OL-37 does not find OL-3782. */
function mentionsKey(text: string, key: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escape(key)}(?![0-9])`, "i").test(text);
}

function mentionsPr(
  text: string,
  ref: Extract<ThreadRef, { kind: "pr" }>,
): boolean {
  return new RegExp(
    `${escape(ref.owner)}/${escape(ref.repo)}(/pull/|#)${ref.number}(?![0-9])`,
    "i",
  ).test(text);
}

/** "Review PR 3728", "#3728", "bb/review-offerlab-pr-3728-thr_x". */
function namesPrNumber(text: string, number: number): boolean {
  return new RegExp(`(#|\\bpr[\\s_-]?|/pull/)${number}(?![0-9])`, "i").test(
    text,
  );
}

export interface MatchThreadRefArgs {
  ref: ThreadRef;
  threads: readonly ThreadWithPendingInteractionState[];
  /** The PR's head branch, or null when GitHub could not say. */
  headBranch: string | null;
  projectName(projectId: string): string | null;
}

/**
 * Threads that did the work for `ref`, strongest evidence first: the thread's
 * own branch, then its title. Threads keep their environment after the
 * worktree is destroyed, so archived work still resolves by branch.
 */
export function matchThreadRef(args: MatchThreadRefArgs): RefMatch[] {
  const { ref } = args;
  const scored: (RefMatch & { score: number })[] = [];
  for (const thread of args.threads) {
    const branch = thread.environmentBranchName ?? "";
    const title = thread.title ?? thread.titleFallback ?? "";
    let score = 0;
    let reason = "";
    const note = (weight: number, why: string) => {
      if (weight > score) reason = why;
      score += weight;
    };
    if (ref.kind === "linear") {
      if (mentionsKey(branch, ref.key)) note(3, `On branch ${branch}`);
      if (mentionsKey(title, ref.key)) note(2, `${ref.key} in the title`);
    } else {
      if (
        args.headBranch !== null &&
        !SHARED_BRANCHES.has(args.headBranch.toLowerCase()) &&
        branch === args.headBranch
      ) {
        note(3, `On the PR's branch ${branch}`);
      }
      if (mentionsPr(title, ref)) note(2, "PR in the title");
      // A bare number only counts inside the repo's own project.
      const inRepo =
        args.projectName(thread.projectId)?.toLowerCase() === ref.repo;
      if (inRepo && namesPrNumber(title, ref.number)) {
        note(2, `#${ref.number} in the title`);
      }
      if (inRepo && namesPrNumber(branch, ref.number)) {
        note(2, `#${ref.number} in branch ${branch}`);
      }
    }
    if (score > 0) scored.push({ thread, reason, score });
  }
  return scored
    .sort(
      (a, b) => b.score - a.score || b.thread.updatedAt - a.thread.updatedAt,
    )
    .map(({ thread, reason }) => ({ thread, reason }));
}

/** Put ref matches ahead of the full-text hits, without duplicates. */
export function mergeRefMatches(
  results: ThreadSearchGroups,
  matches: readonly RefMatch[],
  limitPerGroup: number,
): ThreadSearchGroups {
  const merge = (
    group: ThreadSearchResultGroup,
    archived: boolean,
  ): ThreadSearchResultGroup => {
    const mine = matches.filter(
      (match) => (match.thread.archivedAt !== null) === archived,
    );
    if (mine.length === 0) return group;
    const ids = new Set(mine.map((match) => match.thread.id));
    const rest = group.results.filter((result) => !ids.has(result.thread.id));
    const added = group.results.length - rest.length;
    return {
      total: group.total - added + mine.length,
      results: [
        ...mine.map((match) => ({
          thread: match.thread,
          matches: [reasonMatch(match.reason)],
        })),
        ...rest,
      ].slice(0, limitPerGroup),
    };
  };
  return {
    active: merge(results.active, false),
    archived: merge(results.archived, true),
  };
}

// Shown as the row's snippet, with the title beneath it: why it matched.
function reasonMatch(reason: string): ThreadSearchMatch {
  return {
    sourceKind: "system_message",
    text: reason,
    highlightRanges: [],
    sourceSeq: null,
  };
}

export interface WithThreadRefMatchesArgs {
  query: string;
  limitPerGroup: number;
  results: ThreadSearchGroups;
}

/** The search route's hook. Anything that is not a ref passes through. */
export async function withThreadRefMatches(
  deps: AppDeps,
  args: WithThreadRefMatchesArgs,
): Promise<ThreadSearchGroups> {
  const ref = parseThreadRef(args.query);
  if (ref === null) return args.results;
  const headBranch = ref.kind === "pr" ? await readHeadBranch(ref) : null;
  const projectNames = new Map<string, string | null>();
  const matches = matchThreadRef({
    ref,
    threads: listThreadsWithPendingInteractionState(deps.db, {}),
    headBranch,
    projectName: (projectId) => {
      if (!projectNames.has(projectId)) {
        projectNames.set(
          projectId,
          getProject(deps.db, projectId)?.name ?? null,
        );
      }
      return projectNames.get(projectId)!;
    },
  });
  return mergeRefMatches(args.results, matches, args.limitPerGroup);
}

const GITHUB_TIMEOUT_MS = 5_000;
const HEAD_BRANCH_TTL_MS = 10 * 60_000;
// Search runs as he types, so a failure is remembered briefly too.
const HEAD_BRANCH_FAILURE_TTL_MS = 60_000;
const headBranches = new Map<string, { branch: string | null; at: number }>();

async function readHeadBranch(
  ref: Extract<ThreadRef, { kind: "pr" }>,
): Promise<string | null> {
  const key = `${ref.owner}/${ref.repo}#${ref.number}`;
  const cached = headBranches.get(key);
  const now = Date.now();
  if (
    cached !== undefined &&
    now - cached.at <
      (cached.branch === null ? HEAD_BRANCH_FAILURE_TTL_MS : HEAD_BRANCH_TTL_MS)
  ) {
    return cached.branch;
  }
  const branch = await new Promise<string | null>((resolve) => {
    execFile(
      "gh",
      [
        "api",
        `repos/${ref.owner}/${ref.repo}/pulls/${ref.number}`,
        "--jq",
        ".head.ref",
      ],
      { timeout: GITHUB_TIMEOUT_MS },
      (error, stdout) => {
        const text = String(stdout).trim();
        resolve(error === null && text !== "" ? text : null);
      },
    );
  });
  headBranches.set(key, { branch, at: now });
  return branch;
}
