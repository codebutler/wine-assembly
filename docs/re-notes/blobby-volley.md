# Blobby Volley 1.0

Binary: `packages/freeware/blobby-volley/volley.exe`, image base `0x00400000`.
Delphi/VCL, German UI. Registry entry `blobby_volley` in `lib/apps.js`; the
network match is DirectPlay over the virtual LAN (`src/09d4-dplay-net.wat`).

Companion files mounted with it: `graph.pak`, `sound.pak`, `text.pak`,
`Instructions.txt`, and `settings.dat` — which we ship deliberately, and which
`persistFiles: ['c:\\settings.dat']` lets the guest overwrite per browser
profile. **A person who has played once is running their own copy, not ours**
(`wine._vfsPersistence.restored` says which).

## settings.dat — full format

117 bytes, no header, no version field. Derived by disassembling both ends, not
by inference:

- reader `0x00446420` (inside the function entered at `0x00446237`)
- writer `0x004469fe`

They are field-for-field mirrors: the same globals in the same order with the
same lengths, reader calling `TStream.Read` (`[ebx+0x4]`) and writer
`TStream.Write` (`[esi+0x8]`).

The "stock" column is what the game itself wrote when we captured the file
with `--save-vfs`; where we now ship something different, both are given.

| off  | len   | global      | meaning                                   | stock value |
|------|-------|-------------|-------------------------------------------|---------------|
| 0x00 | 0x18  | `+0x978208` | 6 dwords: p1 left/right/jump, p2 same     | `A D W  ← → ↑` (we ship `← → ↑` twice) |
| 0x18 | 0x04  | `+0x978204` | dword, unidentified                       | 1 |
| 0x1c | 0x08  | `+0x978220` | **CONTROL, one dword per player**         | `0, 1` (we ship `0, 0`) |
| 0x24 | 0x01  | `+0x978228` | byte, unidentified                        | 1 |
| 0x25 | 0x0d  | `+0x978234` | ShortString[12] player 1 name             | `09 "Spieler 1"` |
| 0x32 | 0x0d  | `+0x978288` | ShortString[12] player 2 name             | `09 "Spieler 2"` |
| 0x3f | 0x04  | via `0x43e83c([this+0x30])` | unidentified              | 0 |
| 0x43 | 0x0d  | `+0x97cdcd` | ShortString[12], unidentified             | empty |
| 0x50 | 0x04  | `+0x97cddc` | dword, unidentified                       | 0 |
| 0x54 | 0x1f  | `+0x97cde0` | ShortString[30], unidentified             | empty |
| 0x73 | 0x01  | `+0x978287` | **player 1 colour index**                 | `00` = red |
| 0x74 | 0x01  | `+0x9782db` | **player 2 colour index**                 | `03` = green |

**A truncated file is legal.** The reader re-checks `Position < Size`
(`0x40ece8` = Position, `0x40eccc` = Size) before four of the groups — after
`0x24`, after the two names, after `0x3f`, and after `0x54` — and bails to
`0x4465ec` when the file ends. Fields past the cut keep their compiled-in
defaults, so a preset only has to carry the bytes it wants to change.

Per-player stride is `0x15 * 4 = 0x54` bytes (`imul eax, index, 0x15` then
`[edi+eax*4+base]`), which is why the two colour bytes are `0x978287` and
`0x9782db`, and why the name bases are `0x978234` and `0x978288`.

### CONTROL: `[player*4 + 0x978220]`, 0 = keyboard, 1 = mouse, 2 = computer

Read off the branches in the per-frame input path, not guessed:

- `0x00444392` — `cmp dword [edx+esi*4+0x978220], 0` / on equal, indexes the
  key-state table at `[ecx+edx+0x97ce35]` with the player's configured key →
  **keyboard**.
- `0x004443e3` — `cmp dword [eax+esi*4+0x978220], 1` / on equal, compares
  against `[ecx+0x97d220] shr 1`, half the screen width → **mouse**.
- `2` → **computer**, from the missing-file fallback at `0x0044667a`
  (`mov dword [eax+0x978220], 2` / `mov dword [eax+0x978224], 1`) and
  **confirmed in-game**: with `--control=keyboard,computer` the player-two
  label on the match screen changes from `Spieler 2` to **ADAM**, the AI's own
  name. That is the cheap oracle for this field — the label, not a memory read.
- `4` exists and is compared against a coordinate; still unidentified. It is the
  likely remote-player marker (see the network section).

### What we ship, and why

`packages/freeware/blobby-volley/settings.dat` keeps the game's **stock** key
assignment — player one `A`/`D`/`W`, player two `← → ↑` — with the single
change that **player two is on the keyboard, not the mouse**
(`tools/blobby-settings.js --control=keyboard,keyboard`), because the mouse
never reaches a network client.

The phone pad then sends **both players' key sets at once**: `A`+`←`,
`D`+`→`, `W`+`↑`. Each machine applies only the set of the player it owns and
ignores the other, so one layout is correct everywhere without touching the
stock keys — and a local hot-seat game still gives two people different keys.

That last claim is the one worth measuring rather than assuming, and
`test/test-blobby-vlan.js` now does, with the host holding a key belonging to
the *remote* player:

```
run A   idle drift -67.6px   →   0.0px while the host holds player two's key
run B   idle drift -115.6px  →   0.0px
```

The idle control is not optional: a released blob walks back towards its serve
position on its own, and the first version of this check held `RIGHT`,
measured −125px of that homing drift and "failed" a machine that was ignoring
the key perfectly.

The pad also carries `DOWN`, and there is an **`OK` (Enter)** button, for the
menu rather than the match: a phone tap does not activate a menu item at all,
the menu is arrow+Enter driven, and its selection does **not** wrap past
`ENDE`. Without that button a phone cannot leave the main menu. A
`mouseJoystick` can do none of this — it emits no key events at all
(`lib/touch-controls.js:33`) — which is why the multi-VK form exists in
`lib/touch-controls.js` (a `dpad` direction, or a button's `vk`, may be a
list; the keys are pressed and released together).

Verified on a 375x667 touch viewport, 2026-09-20
(`tools/web-input-probe.js --app=blobby_volley --query= --viewport=375x667
--touch --lan=solo`): tapping `SPIEL STARTEN` on the canvas does nothing,
tapping the `OK` button starts the match, and holding the pad's right edge
walks the blobs right.

A person who wants solo-vs-AI sets player two to COMPUTER on the game's own
options screen; we cannot preset it, for the reason below.

### Do not preset player two to COMPUTER — measured

`--control=keyboard,computer` looks like the obvious solo preset, and it works
locally (the ADAM label above). **It breaks a network match**, because the
joining client does not override the stored value: the AI keeps driving the
client's own blob and the person holding the phone is a spectator.

Measured with the gate, 2026-09-20, `--control=keyboard,computer` shipped:

```
green blob x: host 478.7 -> 527.1 -> 591.1   guest 478.7 -> 527.1 -> 591.1
PASS  the guest moved its own player
PASS  the host saw the guest's player move the same way
FAIL  and saw it come back
```

Both holds moved the blob the *same* direction — right under `D`, right again
under `A` — which is not a key-driven blob at all; it is the AI chasing the
ball while our keys land nowhere. Note that the first two checks **pass
spuriously** on that run: any moving blob satisfies "it moved". The direction
reversal is the check with the teeth, which is the reason the test holds two
keys rather than one.

So the network settings screen's own CONTROL point (`Instructions.txt` §3.2.2)
does not write `[0x978220+4]`, or does not write it before the match starts.
The unidentified value `4` remains the candidate for the remote marker.

### Colour: `0x0044a2c0(this, edx=player, cl=index)`

Not a control setter, despite taking a player index — its 8-arm jump table at
`0x0044a2ee` assigns an RGB value and then recolours the sprite frames:

| index | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| RGB | `ff0000` | `ff7f00` | `ffff00` | `00ff00` | `00ecff` | `0000ff` | `ff00c0` | `ff00d8` |

Shipped `00`/`03` = the red and green blobs on screen. Values above 7 fall
through to the default arm.

## Controls in a network match

`Instructions.txt` §3.2.1/§3.2.2: each side's network settings screen has its
own CONTROL point, and "the host always gets the keys and colour you specified
for player one" / "the client always gets the keys … for player two".

**The client is driven by player two's configured KEYS, not by the mouse** —
`test/test-blobby-vlan.js` measures exactly this, and 2026-09-20 it was shown
to hold *across a remap*, which is the part that makes it a fact about the
file rather than about the arrows. Green went 478.7 → 584.3 → 533.2 under
`D`/`A` with a temporary A/D/W file, and 478.7 → 527.1 → 488.3 under
`RIGHT`/`LEFT` with the shipped arrow file, both screens agreeing each time.

So the keys travel with the settings file, and the mouse never reaches a
network client at all.

### Still open: the live browser pair

In a live browser pair (two pages, RTC wire, 2026-09-20) the client responded to
**neither** arrows nor mouse, while the host's A/D/W drove red and the move
rendered on both screens. The CLI pair above is green on the same code, so the
wire, the sync and the host are all fine and this is something the browser path
does to the client's input. Unresolved.

The measurement that settles it: reach the client's settings screen, read
`[0x978220+4]` out of guest memory to see what CONTROL actually holds there,
then hold player two's keys and watch the blob. Note that the browser pair was
run *before* the remap, against a file whose player two was on the arrows and
on the **mouse** — which is one candidate explanation on its own, and the
shipped file no longer has either property. Check
`wine._vfsPersistence.restored` before reading anything into a repeat: a
player's own persisted `c:\settings.dat` still carries the old values.

## Ruled out

- **Stale persisted settings** as the cause of the dead client. Both live pages
  reported `restored: 0` and their `c:\settings.dat` bytes were the shipped
  ones.
- **Agent input exclusivity** (`lib/agent-remote.js` `setInputBlocked`). Both
  pages reported `{"exclusive": false}` while the client was unresponsive.
- **"The match is hung."** Both guests were `running: true` at `eip 0x4069c0`
  with `yield 7` (message_wait) and climbing frame counters. A ball hanging in
  mid-air is Blobby's waiting-for-serve state; the server jumps into it.
- **The 8-arm table at `0x44a2c0` as a control selector** — withdrawn, it is
  colour (above).
- **Presetting a host IP.** §3.2.2 says an empty address makes the client search
  its own subnet, and our DirectPlay answers that broadcast on the segment, so
  the empty field is already correct.

## Reproduction

```bash
# two processes, one room, a real match (the gate)
node test/test-blobby-vlan.js

# the browser pair
node test/test-web-blobby-rtc.js

# what a live page has mounted
node tools/ctl.js --hub=<hub> --token=<tok> -s <id> eval \
  '(function(){var w=window.__wineInstances[0];var o={};for(const[k,v]of w._helpCtx.vfs.files)if(/settings/i.test(k))o[k]=Array.from(v.data.slice(0,32));return JSON.stringify({f:o,restored:w._vfsPersistence&&w._vfsPersistence.restored});})()'
```

Capture a settings.dat the game itself wrote with `--save-vfs`; that is how the
shipped copy was made.

## Tool commands behind the numbers above

```bash
node tools/find_string.js packages/freeware/blobby-volley/volley.exe "settings.dat"
node tools/find-refs.js   packages/freeware/blobby-volley/volley.exe 0x00446990
node tools/find_fn.js     packages/freeware/blobby-volley/volley.exe 0x00446444,0x00446a2d
node tools/disasm_fn.js   packages/freeware/blobby-volley/volley.exe 0x00446420 130
node tools/disasm_fn.js   packages/freeware/blobby-volley/volley.exe 0x004469fe 150
node tools/disasm_fn.js   packages/freeware/blobby-volley/volley.exe 0x0044a2c0 60
node tools/dump_va.js     packages/freeware/blobby-volley/volley.exe 0x0044a2ee 32
```
