# Maelstrom head observer technical review, 2026-10-24

Historical source last updated, 2026-10-24. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

Status: BLOCKED before cheap/native execution; no acceptance or integration.

Static review: pinned exports lines 180–195 implement breakpoint skip-once;
line 2581 set_bp updates bp_addr and bp_first_caller but does not clear the skip. Thus the corrected fixture's final interior count two is consistent with the
original implementation. OFF uses disjoint 0x7a3c62/66 counters; ON uses
0x7a3362/66, both reject nonzero starting counts. OFF cleanup consumes the final
skip under pending yield before ON begins; ON resets yield, EIP, registers and
stack. These assertions remain unqualified by execution in this task.

The observer instruments the existing arm/run-or-skip boundary with getter-only
state capture, checks halt5/EIP/breakpoint/instruction identity, and rejects raw
watch configuration at parsing before guest memory. Counter counts alone do not
establish MOV/CALL execution. Independent rejecting controls were NOT executed;
no correctness acceptance is inferred from this static inspection.
