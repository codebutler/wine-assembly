# Shared native Module size-bound controls — PASS

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

The three missing boundary/mutation controls passed in **one** execution of the unchanged `guard-controls.cjs --large`. This is execution evidence for the existing shared guard, not full independent guard acceptance, a canonical build, or gameplay qualification.

| Missing control | Observed verdict and causal evidence |
| --- | --- |
| Valid custom-section module exactly 8,388,608 bytes | PASS: construction returned successfully and the native spy increased exactly once. |
| Valid custom-section module 8,388,609 bytes | PASS: size-specific rejection matched `exceeds 8388608`, and native spy count stayed unchanged. |
| Guard-removal mutation | PASS: guarded Sentinel rejected the oversized buffer before entry; replacing the guarded constructor with Sentinel caused the same rejection assertion to fail with `AssertionError`, and final `touched === 1` proved the mutation was armed and reached Sentinel. Oversized bytes were never passed to native validation. |

These results rely on completed in-script assertions, not merely exit code. Each group is appended to `results` only after its assertions complete. The mutation explicitly runs the unguarded Sentinel through the same checking function and requires the resulting assertion failure. No additional mutation or native probe was run. The first actual unexpected failure would abort the script and this task; none occurred. `nativeCalls:3` is the existing spy count: two small view forwarding entries plus exactly one large native entry; it is not a count of every native call in the small groups. Oversized native entries: zero. Large validations were synchronous, one at a time; no Memory or Instance was constructed.

Exact executed argv (cwd `/home/user/wine-assembly-shared-native-bound-boundary-controls-oct23`):

```text
/usr/local/bin/node --max-old-space-size=128 /home/user/wine-assembly-shared-native-bound-boundary-controls-oct23/docs/re-notes/shared-native-bound-boundary-controls-20261023/guard-controls.cjs --large
```
