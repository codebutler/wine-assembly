# Independent region-census acceptance: REJECT

Historical source last updated, 2026-10-27. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

Exact candidate `66436f785bbe3166a992402f95abf083ca0d6736`, compared with base
`1cf9788cc3ac807027206c39fcbf1d2771599845`, falsely succeeds when region
declarations change between the four combined build gates. No candidate repair
or main integration was performed.

The first behavioral checkpoint ran the actual original CLI in four separate
processes and the exact candidate CLI with `--build-gates` against the unchanged
portable fixture. Both exited 0 with byte-identical stdout and stderr. The build
file retains the command order `--gate`, `gen-region-map --check`, then
`--build-gates`; this order was inspected/asserted, not executed as a full build. The four original processes execute js-copies, embedded-wat, dup-payloads,
hand-rolled, stopping on first failure.

The next checkpoint planted one change after the first read of `host.js`, after
the js-copies gate had read declarations and computed its layout:

```wat
(region.declare $INDEPENDENT_INVALID (size 0x1000) (align 3))
```

| Path | Exit | Observable outcome |
| --- | --- | --- |
| Original separate processes | 1 | js-copies passes; embedded-wat rejects `(align 3) is not a power of two` |
| Exact candidate combined process | 0 | All four gates report OK; no stderr |

`tools/region-census.js:694` retains the first `collectDeclarations()` result;
the embedded-WAT scan reuses it through `declarations(options)` at line 629. `tools/region-layout.js:87` also returns a memoized layout before rereading its
source. Grouping previously separate processes makes that existing cache span
gates. Later hand-rolled scanning reads the changed declaration text but does not
recompile it. Thus the candidate suppresses the validation the original next
process performs. This finding concerns changes between gates, not a claim that
an initially invalid declaration passes the first gate.

Acceptance stopped at this first demonstrated defect: eight actual CLI
invocations total (five clean, two failing-path original, one failing-path
candidate). No broad legacy/default/record/unsupported matrix, additional
omission controls, main-dependency execution, or independent read/parse/layout
reduction measurements were run after rejection. The unchanged fixture/baseline
was used for the clean comparison; no baseline was edited to pass.

The donor's `final-delta-results.json` names census source SHA-256
`86de689e82f7d942a6d81d3db78b8a77dbd67aebac44b65e8acbedbc9973b5b1`,
matching the tested final candidate, rather than only the intermediate revision. Its retained final cases cover same-file JS text and JS directory discovery;
they do not establish declaration freshness between gates. Its prior test
results and reported reductions are inherited evidence, not this worker's
independent acceptance or independent measurements.
