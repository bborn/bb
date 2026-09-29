// FORK-ONLY (bborn/bb): see thread-ref-search.ts.
import { describe, expect, it } from "vitest";
import type { ThreadWithPendingInteractionState } from "@bb/db";
import {
  matchThreadRef,
  mergeRefMatches,
  parseThreadRef,
  type ThreadRef,
} from "./thread-ref-search.js";

function thread(
  over: Partial<ThreadWithPendingInteractionState> & { id: string },
): ThreadWithPendingInteractionState {
  return {
    title: "Untitled",
    titleFallback: null,
    projectId: "proj_ol",
    archivedAt: null,
    updatedAt: 1,
    environmentBranchName: null,
    ...over,
  } as ThreadWithPendingInteractionState;
}

const PR = parseThreadRef("https://github.com/offerlab/offerlab/pull/3728")!;
const TICKET = parseThreadRef("OL-3782")!;

function match(
  ref: ThreadRef,
  threads: ThreadWithPendingInteractionState[],
  headBranch: string | null = null,
) {
  return matchThreadRef({
    ref,
    threads,
    headBranch,
    projectName: (id) => (id === "proj_ol" ? "offerlab" : "taskyou"),
  }).map((found) => [found.thread.id, found.reason]);
}

describe("parseThreadRef", () => {
  it("reads PR and Linear links however the browser pasted them", () => {
    const pr = {
      kind: "pr",
      owner: "offerlab",
      repo: "offerlab",
      number: 3728,
    };
    expect(
      parseThreadRef("github.com/OfferLab/offerlab/pull/3728/files"),
    ).toEqual(pr);
    expect(parseThreadRef("offerlab/offerlab#3728")).toEqual(pr);
    const key = { kind: "linear", key: "OL-3782" };
    expect(parseThreadRef("https://linear.app/ol/issue/OL-3782/retry")).toEqual(
      key,
    );
    expect(parseThreadRef("ol-3782")).toEqual(key);
  });

  it("leaves ordinary searches alone", () => {
    for (const text of [
      "cart",
      "#3728",
      "2026-09-01",
      "stripe webhook",
      "github.com/../../pull/1",
    ]) {
      expect(parseThreadRef(text)).toBeNull();
    }
  });
});

describe("matchThreadRef", () => {
  it("puts the thread on the PR's branch first, archived or not", () => {
    expect(
      match(
        PR,
        [
          thread({ id: "thr_title", title: "Review PR 3728", updatedAt: 9 }),
          thread({
            id: "thr_owner",
            archivedAt: 5,
            environmentBranchName: "bb/retry-charge-thr_owner",
          }),
        ],
        "bb/retry-charge-thr_owner",
      ),
    ).toEqual([
      ["thr_owner", "On the PR's branch bb/retry-charge-thr_owner"],
      ["thr_title", "#3728 in the title"],
    ]);
  });

  it("does not let a PR from main claim every thread", () => {
    expect(
      match(
        PR,
        [thread({ id: "thr_a", environmentBranchName: "main" })],
        "main",
      ),
    ).toEqual([]);
  });

  it("trusts a bare PR number only in the repo's project", () => {
    expect(
      match(PR, [
        thread({ id: "thr_x", title: "PR 3728", projectId: "proj_ty" }),
      ]),
    ).toEqual([]);
  });

  it("finds a Linear key as a whole token in branch or title", () => {
    expect(
      match(TICKET, [
        thread({ id: "thr_near", title: "OL-37820 something" }),
        thread({ id: "thr_title", title: "OL-3782: retry" }),
        thread({
          id: "thr_branch",
          environmentBranchName: "bruno/ol-3782-retry",
        }),
      ]),
    ).toEqual([
      ["thr_branch", "On branch bruno/ol-3782-retry"],
      ["thr_title", "OL-3782 in the title"],
    ]);
  });
});

describe("mergeRefMatches", () => {
  it("leads each group with its matches and drops the duplicate hit", () => {
    const owner = thread({ id: "thr_owner" });
    const other = thread({ id: "thr_other" });
    const gone = thread({ id: "thr_gone", archivedAt: 3 });
    const merged = mergeRefMatches(
      {
        active: {
          total: 2,
          results: [
            { thread: other, matches: [] },
            { thread: owner, matches: [] },
          ],
        },
        archived: { total: 0, results: [] },
      },
      [
        { thread: owner, reason: "On branch x" },
        { thread: gone, reason: "On branch y" },
      ],
      50,
    );
    expect(merged.active.total).toBe(2);
    expect(merged.active.results.map((r) => r.thread.id)).toEqual([
      "thr_owner",
      "thr_other",
    ]);
    expect(merged.active.results[0]!.matches[0]!.text).toBe("On branch x");
    expect(merged.archived.results.map((r) => r.thread.id)).toEqual([
      "thr_gone",
    ]);
  });
});
