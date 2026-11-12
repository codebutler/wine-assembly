# Penguin provider wire adapter repair (offline)

Actual Boat exec response metadata and key order differ from the original canonical response. The pinned original restore_images rejected deterministic PNG records wrapped in the genuine full response envelope with `response changed/framing/truncation mismatch`. Original receipt: ops/original-failure.json. The real 333-byte fixture has stdout `delivered\n`; it is framing evidence, never a PNG or Penguin runtime observation.

The added plan_provider_images / ProviderCapture adapter accepts the exact bounded16-field successful Boat envelope, validates status/types/timestamps/no truncation, rejects unknown/missing/duplicate fields, and retains exact planned manifest/chunk/end identities plus the existing bounded base64/zlib EOF/size/hash decoder. The legacy canonical API stays exact. Provider metadata and JSON order may vary; envelope overhead defaults1024 bytes per capture response and is explicitly bounded at8192. Whitespace and alternate escaping consume the same reserve. A larger envelope requires a new plan, never a cap increase.

Every earlier response is included in `used`. Feed each subsequent original serialized response exactly once through accept(raw) for captures or account(raw) for all other replies, including failures/polls/metadata. Charges use len(raw), before validation; rejected responses remain charged and poison the collector. Non-capture bytes spend the reserved tail; every step must still reserve remaining capture frames and unspent tail within1048576 bytes. finish() exposes no PNG until the full stream verifies. Caller must supply the complete chronological response inventory and cannot use parsed/reserialized API objects as raw input.

The restore-provider CLI consumes an ordered transcript of capture/account raw response filenames. It validates everything before atomically publishing a new output directory. Explicit non-capture responses are charged even if their body is not successful JSON; they are never capture data. No controller/ownership security or guest execution was added.

Validation: ten affected offline tests passed on the final source (ops/py-1793076927272646801.{log,json}), including the real CLI, legal metadata maxima/UTF8/key order, worst-case reserved framing at the exact1MiB boundary, status/schema/truncation failures, corrupt/missing/duplicate/reordered chunks, zlib EOF/trailing/bomb/size/hash failures, and no partial publication on four independent CLI rejection modes. Original LaunchTests and all launch helper functions have unchanged ASTs; accepted exact closure receipts are pinned in validation.json and reused. No Node/guest/build/browser/Boat work occurred.

Two retained historical PNGs passed their unchanged independent canonical-only roundtrips. BOTH provider-aware plans reject at the1MiB cap with full-envelope reserves. They are not qualified runtime transfers. The new small fixture is explicitly synthetic lossless transport evidence, not a real Penguin capture.

Reproduce the affected suite under the task controls from the host:

```sh
PENGUIN_CONTRACT_RECEIPTS=/tmp/penguin-production-wire-adapter-repair-oct27/ops/receipts python3 scratch/usage-watch/light-execution-pool-oct26.py --slots 1 -- python3 -B /tmp/penguin-production-wire-adapter-repair-oct27/ops/control.py py /tmp/penguin-production-wire-adapter-repair-oct27/repo/test/test_penguin_capture_contract.py ProviderTransportTests TransportTests
```

Retained small CLI fixture: ops/receipts/cli-fixture/{fixture.png,ack.json,0.json,1.json,2.json,transcript.json}. A direct production entry-point replay (new output directory required) under the same pool/supervisor uses:

```sh
python3 scratch/usage-watch/light-execution-pool-oct26.py --slots 1 -- python3 -B /tmp/penguin-production-wire-adapter-repair-oct27/ops/control.py py /tmp/penguin-production-wire-adapter-repair-oct27/repo/tools/penguin_capture_contract.py restore-provider /tmp/penguin-production-wire-adapter-repair-oct27/ops/receipts/cli-fixture/fixture.png --transcript /tmp/penguin-production-wire-adapter-repair-oct27/ops/receipts/cli-fixture/transcript.json --output /tmp/penguin-production-wire-adapter-repair-oct27/ops/replayed-png --used 0 --tail-reserve 333
```

The initial new tail-boundary test used18 bytes against17 reserved and correctly failed. That fixture was corrected to16+1 without changing the contract; the failure is preserved. An intermediate checkpoint associated an earlier legacy receipt with the newly factored source; the final exact-source ten-test receipt and checkpoint supersede that association. Earlier admission-compliance failures remain historical failures.

Resource projection28MiB fits the assigned32MiB allocation: source/Git8, launcher/session/events8, ops projected4 of8, reserve8. Coordinator8MiB is separate. Fresh and ongoing admission measures allocation, positive WAL growth once, diskfloor2982150144, aggregate memory, and supervised cleanup. Donor stores are read-only alternates; no full checkout/fetch/repack or root tracked/index/ref mutations. Trusted Git SSH configuration is pinned; no runtime mounts exist to validate.

Independent acceptance and separately authorized main integration remain. Future gameplay still requires admitted provider-aware capture sizing and diagnostic-separated startup/mount/runtime acceptance; actual original-game visible projectile and gameplay remain OPEN. A40033 ammo/count change is not visible projectile evidence. No assigned/running/touched boxes; all prior boxes remain coordinator-owned and snapshot-stopped.
