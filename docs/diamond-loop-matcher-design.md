# Design D: a multi-block diamond loop matcher

**Status: proposal, not implemented. Needs sign-off before any WAT is written.**

## The observation

Every loop fold in the tree today is a hand-written special case for one app,
and the corpus censuses say so plainly:

| fold | corpus reach |
|---|---|
| `RLE_RUN` (H424) | **1** of 287 PEs (Caesar III) |
| `CK_LUT*` | 613 matches, **297 of them in one DLL** (SimGolf's `jgl.dll`) |
| `IMPLODE_CMP_RUN` (H466) | PKWARE implode only; zero outside compression |
| `PCX_RUN` (H462) | Quake II PCX/WAL |
| `SMK_TREE` | Smacker |
| `colorkey8` (H443) | Alpha Centauri's dest-keyed row |

Meanwhile, look at what the *profiles* keep naming as hot — in different apps,
measured independently, on different machines:

| app | hot region | share of block entries |
|---|---|---|
| StarCraft | `storm.dll` #437 span-list build + #432 span copy | **35.8% / 37.8%** (two boxes) |
| Diablo | signed-RLE + clipped-row clusters | 8.2% + 7.2% |
| Caesar III | the RLE token ladder at `0x40f71c` | (the reason `RLE_RUN` exists) |
| StarCraft (menus) | keyed byte blit `0x004c7a68` | 10.8% of that window |

**Every one of those is a multi-block diamond, and every one is invisible to the
matcher by construction.** `$loop_match_block` in `src/07b-loop-match.wat` only
ever runs on a block that branches to *itself*. A conditional store, a sentinel
test, a transparent-pixel skip — any of them splits the body into two blocks and
the loop vanishes from every recognizer we have. The existing tools say this
about themselves: `find-ck-lut-nests.js`'s header notes that a
`cmp byte [esi],0xff / jnb skip` makes a loop invisible, and `find-rle-nests.js`
exists precisely because `find-loops.js` "classifies a single self-loop *block*,
and this is a nest of ~20 blocks".

So the shape that recurs across unrelated apps is the one shape we cannot see,
and we have been paying for that with one bespoke fold per app.

## The claim to test

> A recognizer that matches a *small cycle of blocks* rather than a single
> self-looping block would subsume several of the existing one-app folds and
> reach the hot regions that none of them cover.

This is a claim, not a result. It is the thing the prototype has to establish
or refute.

## Why this is plausible

The diamond is not an arbitrary graph. In every instance above it is:

```
        ┌──────────────┐
        │  HEAD        │  load from a streaming source, test it
        └──┬────────┬──┘
           │ taken  │ not taken
        ┌──▼───┐ ┌──▼────┐
        │ ARM A│ │ ARM B │   each: branch-free, a few ops, stores or skips
        └──┬───┘ └──┬────┘
           └────┬───┘
         ┌──────▼──────┐
         │ LATCH       │  advance cursors, decrement, branch back to HEAD
         └─────────────┘
```

with the latch often folded into the arms. The properties that make Design A's
predicates work — induction variables, memory streams, no calls, no side
effects beyond the streams — are properties of the *cycle*, not of a block.
Design A's existing role analysis should lift to a cycle largely unchanged;
what is new is finding the cycle and proving it is closed.

## Sketch

1. **Detect at decode time**, where we already are when a backward branch is
   emitted. When a block's terminator targets a block we decoded within the
   last N blocks, walk forward from that target and collect the blocks reachable
   before control returns to it.
2. **Admit only a closed, bounded cycle**: ≤ 4 blocks, single entry (the head),
   every exit either back to the head or out of the loop entirely, no calls, no
   indirect branches. Reject on anything unknown rather than guessing — the
   rule `find-rle-nests.js` already follows.
3. **Run Design A's role summary over the union of the arms**, with each arm's
   stores predicated on the branch condition that reaches it.
4. **Emit one super-op** whose body is the whole diamond, iterating until the
   trip count or the sentinel ends it.

Step 2 is where this lives or dies. A cycle admitted too liberally is a
miscompile in code we cannot enumerate.

## What must be true before any of this is written

- [ ] **A static census.** Extend the existing nest finders into one
      `tools/find-diamonds.js` and run it over all ~1271 PEs. If the answer
      looks like `RLE_RUN`'s (1 app) this proposal is dead and we have saved
      the implementation.
- [ ] **A hotness census, multi-window.** Static reach is not the argument —
      `tools/hot-loop-census.js` over several windows per app, because this has
      already cost two sessions (H455 on SimGolf; the `0x004c7a68` retraction
      in `docs/re-notes/starcraft-shareware.md`). Build only against the
      "hot in EVERY window" list.
- [ ] **A correctness oracle first.** See below — this is the real blocker.

## The prerequisite: correctness (task A)

A diamond matcher is strictly more dangerous than Design A. Design A rewrites
one block whose entire body it has proven; this rewrites a *control-flow
structure*, and the failure mode is a wrong picture in some app nobody thought
to run.

Today we have no way to catch that. Six folds are **on by default for every
user** —

```
sib_fusion  rect_run  case_chain  rle_run  smk_tree  pcx_run
```

— and none has ever been run through a registry-wide A/B. `tools/block-exec-sweep.js`
is already the right harness and is already parameterized (`--flag=NAME`), but it
has only ever been pointed at `--block-exec`.

Two things make it sharper, and both are cheap:

1. **Pin the calendar clock in both arms** (done: `--wall-clock-ms`, on by
   default, `--no-pin-clock` to revert). Unpinned, an app that seeds itself
   from the date disagrees with *itself* — 88,435 of 98,304 bytes on the
   StarCraft save route — which is most of what the null band absorbs. Pinned,
   a deterministic app compares as bytes and its band goes to zero.
2. **Invert the arms for a default-on fold**: `--flag=no-rect-run` makes the
   deviation arm the one with the fold *disabled*. No tool change needed.

**Recommended order: A before D.** Validate the six folds that already ship on
by default, and the harness that does it becomes the gate the diamond matcher
has to pass. If validating the existing six turns up a miscompile, that is a
more valuable finding than the new fold would have been.

## Risks and honest unknowns

- **The cycle may not generalize.** Storm's `#437` is a per-tile-cell state
  machine, not a pixel loop; it may need more than 4 blocks, or carry state the
  role analysis has no vocabulary for. I have not read it.
- **Decode-time cost.** Walking a cycle on every backward branch is more work
  per decode than Design A's single-block check, paid by every app whether or
  not it matches. `--decode-stats` is the instrument.
- **Interaction with the block executor.** `07c-block-exec.wat` already runs
  whole blocks; a diamond fold and the executor may overlap or conflict. The
  measured relationship (`blk_mix512`: executor +42% → −11% depending on the
  leaf) says this is not obvious either way.
- **It may simply be a smaller win than one good Storm fold.** 35.8% in one app
  is a large, certain number. A general matcher that captures half of several
  5% regions may be worth less for much more work.

## Decision asked for

Approve or decline **the census step only** (`tools/find-diamonds.js` plus a
multi-window hotness pass). That is measurement, costs no source risk, and its
result decides whether the rest is worth designing in detail.
