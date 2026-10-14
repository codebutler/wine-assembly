#!/usr/bin/env node
'use strict';

// ACM MS-ADPCM and IMA ADPCM decode. QMixer (Outwars) refuses to start its
// mixer without an ADPCM->PCM stream ("ACM is not installed") and Tomb
// Raider III looks the MS-ADPCM codec up by its driver short name; a stock
// Win98 has both codecs. The vectors are a 440 Hz tone that ffmpeg encoded
// (adpcm_ms / adpcm_ima_wav, 11025 Hz, 1024-byte blocks, mono and stereo).
// MS-ADPCM must equal ffmpeg's own decode of the same files exactly (SHA-256):
// ffmpeg and Windows (as Wine's msadp32 reproduces it) share that arithmetic.
// IMA does not: ffmpeg computes the difference as ((2*code+1)*step)>>3, while
// Windows' imaadp32 accumulates step>>3 + step>>2 + step>>1 + step bit by bit
// (Wine's process_nibble), which rounds a little lower. So IMA is compared
// exactly against the reference decoder below, written from that algorithm,
// and against ffmpeg's decode only within a few LSB, which still proves the
// block layout, nibble order and channel interleave. The rest checks the ACM
// surface around the decoders:
// driver enumeration continues until the callback says stop, driver details,
// format suggestion, stream sizing, header preparation and the error paths.

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createHostImports } = require('../lib/host-imports');
const { compileSrcWasm } = require('./compile-src');

const ROOT = path.join(__dirname, '..');

// ffmpeg -f lavfi -i "sine=frequency=440:sample_rate=11025:duration=0.12" -c:a adpcm_ms|adpcm_ima_wav
// (the stereo files mix the tone with a half-level copy delayed 3 ms), and
// ffmpeg -i X.wav -f s16le -acodec pcm_s16le X.pcm for the expected decode.
const VECTORS = {
  "ms_mono": {
    "wav": "UklGRnQEAABXQVZFZm10IDIAAAACAAEAESsAAIA+AAAABAQAIAD0BwcAAAEAAAACAP8AAAAAwABAAPAAAADMATD/iAEY/2ZhY3QEAAAAKwUAAExJU1QaAAAASU5GT0lTRlQOAAAATGF2ZjYwLjE2LjEwMABkYXRhAAQAAAAQAC0DAAB3dgAO7dzO7uASREQzMiEO2s3N3e4BNFQ0MyIQ7bzNze7gA0RENCMRD9vb3d3u8TRUNDMyEO28zc3e4ANEREIyIR7cvc3O7gAjYzRCIhHuzMzd3u8CU1M0MyEP682+3e4AI1RDNCIR/czM3d3vEkRTNDMiD9y83c3u8CQ2M0MiIP7L3Nzt/wE1Q0MzMg/cvNzd3vAjVEQjMiANzL3c7f/yNFNEIjEA7NvN3e7gI1RDQzIgDsvc3N7vATRTQ0IxH+283N3d8BNjRDMyIQ7L3M3e3wE1NTQjMRDszNzO3vASREQzMyH/y9zN3u4BJTU0IzEQ/Nrdzt7gEkU0NCIhD9vNzd3f8SVENDMiIO2tzN3e4BJFNEMyIQ/bzb7d7/EjY0NCMSDuvb3d3e8TRTUzMyEP28zc3e7xJERDQyIg/cvc3O7vAjVDQzMxHuvM3N3u8CREQ0MiIP69vd3O7xE1Q0MzMg/crdvu3/ATU0QzMhH+vb3N7e8CNUNSMyEf7MzN3O4AElNEMzIh/r29ze3vATVDUjMhEOzMzdzu8BNERDMzIf7L293t7gE1RDNDIhDszM3O3vASU0QzQhEO3L3N3e4BNUNSMzIf7bzNze7gEkU0M0Ih/9y9zd3eASVENDMiEPzMzc3u7xNERDQjIf/cvc3c7/EjVDQzMhD9rczd7eACU1M0MyEO682+3e/wJEQ0QiIR7szM3d7vA0REQzIiD9y83c3uACNUQzNCEP7MzN3d7xI2Q0MzIg/cvNzd7vAjVENDIxANzMzc7f8BNTUzMyIf3Lzc3d7wI2NEMyMR/svcze3vATVDUjMhH+2tzc7e8CJTUzMzIf68293e3wE1RDQzIh/szM3N7uATRTQ0IxH/283N3d/3cAAAAB8fHx8fHx8fHxDx8fHwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    "pcmBytes": 4072,
    "ffmpegSha256": "4bac53d689372caf73327c607320b8197b08490a7463af21ea4eb449dd14a2db"
  },
  "ms_stereo": {
    "wav": "UklGRnQIAABXQVZFZm10IDIAAAACAAIAESsAAIA+AAAABAQAIAD0AwcAAAEAAAACAP8AAAAAwABAAPAAAADMATD/iAEY/2ZhY3QEAAAAKwUAAExJU1QaAAAASU5GT0lTRlQOAAAATGF2ZjYwLjE2LjEwMABkYXRhAAgAAAAAEAAQAPgDAAAAAAAAcHBwcBAA8PDQ4MDQwODQ4PAAECBAQEBAMDAwMCAQAODHx7fTwdHg3978DQw8TV1OPj5AMSIlFAPl0rPD0rLh0O/s7AwcLT1sPU4/MEAjJBQF49PDs9PD0dDe3Pv8HSxdTD5ePz8hMiQUBPPUs8PD0sLf7+zs+x0tTE1NTT5AISIkFQTz47TTw8LR0N7d6/wdK05dTT5OMCAzIyYD5NTCs8PSweDf7ev8HRtOTU1OPz9BIiMWA/TjxLPS0rHh7u3s+x0cPF49Xj8vMDIkIwbz07PUstLB0e/d/PsNLD1sPk4+TyEyIxUT9dPDw7PS0tDf3ev8DCxNTV49Tj8wMjQVE/TUs8PSstLQ797r/A0rPm09TT9PMDIjJQT048Sy08LB4d/t7PwMHD1cTj5OP0AhJBMV8+TTtMLSwdHf3uz8/C1MTU1NPk8wIjMWFPPkw8Oz09HRz+3s+wwdPE1cPk8/MEEjFBT049Szw9LC0d/t3PwLHTxdTk0+TzAhMxUUBOPDxMPC0sDg3vzsDBw9TF49Tj8wMTMkFfPkw7TSstLQ0O7d+wwdPE1dTT1PMCEzJgMF49Oj08PSwd/u6+0LHC1dPV0+PjBBJCQU9PPUs8PTwtHP7uz8Cx0sPV5NPU8wMTIVJPP1wsPDw9HB0O7d+wwMPUxOXT4/P0EjJBT09NPEstLC0dDe3ewLDTxdTD5ePzAgMiQUBPPEw8PTstHg3uzsDAw8TU1OTT8/QSIlEwXz1LPTwsLR0N/d6/wcPUxePV4+IDAzIyYD5NSzwtOy4dDe7ewLDC1NTE5NPz8xQiMWA/TUwsOy4sLg7u7rDA0sPUxePk4/ITIjJQTz1bLD0sLB0O/d/PwMLE1NPV0/TyAyFCUD9eLDxMLB0dHf3e37HC08bU49Tz8wMiQkBPTTs9SywuLQ393sDAwcTUxOTj5PIDIjFRTz5MOz08PR0d/d2v0MLE1dPF4uQCAhIxUT9ePTs8PSwuHf3ev8DC08XU09Xi8wMiMWFPPkw8PDwtLRz+3r/B0bLV09TU4/MDIzFhP148Oz07PR4d/d7PsMHTxdTT1eLjAyIyYDBePDw8PD0tDf3tv8DRs9bT1dPj8/MjMmEwXTw7PD08LQ0O3c+wwdPF1NPV0/IDE0FBQE48TDw8PS0MDu7Pv9Gz5NTU1NPzBBIxUUBOPTxLPSwtHf79z8/Bw9XE49Tk8wITIlE/T0w8TC0rLh3+/t6wwdLE1NTU0/PzEzJhME5NOjxNLC0NDf3fv8HTxNXU0+Tj8xIzUU9PPEw8PTstHg3u3qDB0sTU1NTj4/QSMlFATz1LPTs9LR0N7t6vwdPE1dPV0/LzEzJBUU49QAAIwAngD8BiQFVgp2A5LS0cDv3fv9HCw9bT1NPj9BIyQVBPPUw8Oy09HQ3u3r/Aw9TE1ePU8/MDMjFgTz07TD0rLi0N7t7PscLTxeTU4+TyEyEyYD9NTDwsPC0dDf3ez7HC1NTF49Tz8gMiQkBPTjs8TSwsHR7938+w0sPV1MPl8vMCIjJQP148PDw8LS0N/d6/wcHUxNXT0+TzAyJCUD9OSz0rPT0cDf7uv8DSw8XT1ePj9AIiQkBPPl0rPDwtHR393t+g0rPm09Xj4/MDIjJQQD1MSy07LR4d/e7PwMHD1dTE4+P0AyIxQV8+TTo9PD0sDQ7ev8DRs9TV09Tj9AISMmAwXj07PD08LQ0N3s6wwtPF1MTj9PPyIyJAQE48TDw8PRweDd7PwLHSxOXT1OPjBCIxQVBOPUs9Kz0dHQ7tz8/HpwAAAAAAAAAAEPAQ8BDwEPEf8Q8R/xH/Ef8R/xH/EfAf8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R/xH/Ef8R",
    "pcmBytes": 8096,
    "ffmpegSha256": "5836ec45a3701337b20d088168bccd6d5d7df9baa70847638977ba9fc759d90e"
  },
  "ima_mono": {
    "wav": "UklGRlYEAABXQVZFZm10IBQAAAARAAEAESsAAIA+AAAABAQAAgD5B2ZhY3QEAAAAKwUAAExJU1QaAAAASU5GT0lTRlQOAAAATGF2ZjYwLjE2LjEwMABkYXRhAAQAAAAAAAB3d3c3mru8q6oAUlNDMxKBuc28u6uKIUU0NDIRmNu8rauqGDI2RDISgam9vbu7iiFFUzMzEpjbzKy7qQhCYzMkIoGpzLy8qoogU0QzMxKQ28zLq5sIQTQ1MyOCqc3MuquZIFNEMzMikNvMy6ubCTJFNDMjArnNvLy6mSBTNCUjEoDKzMurmwkxRVMyIoKo68usq5kQUlMzQxGAydvLu6qIMUVTMhMCqMzbu7uaKFNEQyMigMrru6yqCTBENDQiAqjbzLu7mhhTREMjIoDJ27y7qwowRTQ0MhGo28y7u6oYU0RDIyKBus3buqqJIEQ0NCMRmNvMu7ubGFJEQyMTgbnN27qqiiFjQyQjEZjKvbyrmwhCRDQzIwG6zby8qoogNDZDIhKIy8zLq6oIMkU0MyMBuc28vKqKEDRFMzMiiNvMy6ubCTJFNDMjArnNvLy6mSBTRDMzIpDLzcu7mgkxRTQzMwGpzby8upkQUzQlIyKQur7MupoJITU1MzMCqdy8vKuKGFM0RCISgLnNy7uqCTFUUzIjAajbzLu7mhhTREMjE4DJ67usqokhRDQ0MgGg28y7u6oYU0RDIxOBus28u6uKMUU0NCISqMvNu7ubCFNEQyMTgbnNvLu7iTBUNDQjEaDazLu7mxlSNDUzI4G5zcy6uokgRFMzMxKg28zLq6oIQmMzJCKBuMy8vKqKIFNEMzMSkNvMy6uqCEFTNDMjArnNvLy6mSBTRDMzIpDbzMurmwkyRVMyIgGozLy8upkQUzQlIyKIur6tu6oJMUU0MzMBqM28vLqZGFM0JTMSgMq8vburiTJFNDQiAqjM27u7mhhTRCQzEoDJvL27q4kxRTQ0IgKYvL7LupkYQkRDIxMAus28u6uKdwAIgAiACAiACICACAiAgAiACAiACIAIgAgICAiAgIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    "pcmBytes": 4082,
    "ffmpegSha256": "0a7ef67d9ee9e8b487fed91354c8a4467aed098cb04e2a9d82130ade050006be",
    "ffmpegPcm": "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/v8aAAAAFwACAO//AAAQAAIA9f8BAPb/AAAJAAEA+v8AAAYAAQD8/wAABAABAP7/AQD//wEA//8BAP//AAABAAAAAQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
  },
  "ima_stereo": {
    "wav": "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",
    "pcmBytes": 8136,
    "ffmpegSha256": "d41252cec8447fa1a723ba72a95d43b43080d88324286388cd8c472c2fcba3e6",
    "ffmpegPcm": "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/v/6/xoAAAAAAAYAFwABAAIA/P/v/wAAAAAEABAAAQACAP7/9f8BAAEA///2/wEAAAD//wkAAQABAP//+v8AAAAAAQAGAAAAAQABAPz/AAAAAAEABAAAAAEAAAD+/wAAAQAAAP//AAABAAAA//8AAAEAAAD//wAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
  }
};

const extraWat = String.raw`
  (func (export "test_acm_stream_open")
        (param $phas i32) (param $src i32) (param $dst i32) (param $fdw i32) (result i32)
    (local $saved i32) (local $sp i32)
    (local.set $saved (i32.load offset=16 (global.get $reg_base)))
    (local.set $sp (i32.sub (local.get $saved) (i32.const 64)))
    (call $gs32 (local.get $sp) (i32.const 0))
    (call $gs32 (i32.add (local.get $sp) (i32.const 4)) (local.get $phas))
    (call $gs32 (i32.add (local.get $sp) (i32.const 8)) (i32.const 0))
    (call $gs32 (i32.add (local.get $sp) (i32.const 12)) (local.get $src))
    (call $gs32 (i32.add (local.get $sp) (i32.const 16)) (local.get $dst))
    (call $gs32 (i32.add (local.get $sp) (i32.const 20)) (i32.const 0))
    (call $gs32 (i32.add (local.get $sp) (i32.const 24)) (i32.const 0))
    (call $gs32 (i32.add (local.get $sp) (i32.const 28)) (i32.const 0))
    (call $gs32 (i32.add (local.get $sp) (i32.const 32)) (local.get $fdw))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (call $handle_acmStreamOpen (local.get $phas) (i32.const 0) (local.get $src)
      (local.get $dst) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_acm_call") (param $op i32)
        (param $a i32) (param $b i32) (param $c i32) (param $d i32) (param $e i32) (result i32)
    (local $saved i32)
    (local.set $saved (i32.load offset=16 (global.get $reg_base)))
    (if (i32.eq (local.get $op) (i32.const 1))
      (then (call $handle_acmStreamSize (local.get $a) (local.get $b) (local.get $c) (local.get $d) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 2))
      (then (call $handle_acmStreamPrepareHeader (local.get $a) (local.get $b) (local.get $c) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 3))
      (then (call $handle_acmStreamConvert (local.get $a) (local.get $b) (local.get $c) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 4))
      (then (call $handle_acmStreamUnprepareHeader (local.get $a) (local.get $b) (local.get $c) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 5))
      (then (call $handle_acmStreamClose (local.get $a) (local.get $b) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 6))
      (then (call $handle_acmFormatSuggest (i32.const 0) (local.get $a) (local.get $b) (local.get $c) (local.get $d) (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 7))
      (then (call $handle_acmDriverDetailsA (local.get $a) (local.get $b) (local.get $c) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 8))
      (then (call $handle_acmMetrics (i32.const 0) (local.get $a) (local.get $b) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 9))
      (then (call $handle_acmFormatTagDetailsA (i32.const 0) (local.get $a) (local.get $b) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 10))
      (then (call $handle_acmDriverOpen (local.get $a) (local.get $b) (local.get $c) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 11))
      (then (call $handle_acmDriverClose (local.get $a) (local.get $b) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 12))
      (then (call $handle_acmDriverPriority (local.get $a) (local.get $b) (local.get $c) (i32.const 0) (i32.const 0) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_acm_stream_open_had")
        (param $phas i32) (param $had i32) (param $src i32) (param $dst i32) (result i32)
    (local $saved i32) (local $sp i32)
    (local.set $saved (i32.load offset=16 (global.get $reg_base)))
    (local.set $sp (i32.sub (local.get $saved) (i32.const 64)))
    (call $gs32 (i32.add (local.get $sp) (i32.const 32)) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (call $handle_acmStreamOpen (local.get $phas) (local.get $had) (local.get $src)
      (local.get $dst) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved))
    (i32.load offset=0 (global.get $reg_base)))

  ;; acmDriverEnum without a CPU: start it, then play the callback's part
  ;; (pop its frame, answer in EAX) and run the CACA0007 continuation.
  (func (export "test_acm_enum_start") (param $cb i32) (param $inst i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (call $gs32 (local.get $sp) (i32.const 0x00401234))     ;; caller's return address
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (call $handle_acmDriverEnum (local.get $cb) (local.get $inst) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (local.get $sp))
  (func (export "test_acm_enum_start_fdw") (param $cb i32) (param $inst i32) (param $fdw i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (call $gs32 (local.get $sp) (i32.const 0x00401234))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (call $handle_acmDriverEnum (local.get $cb) (local.get $inst) (local.get $fdw)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (local.get $sp))
  (func (export "test_acm_enum_callback_returns") (param $answer i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (i32.store (global.get $reg_base) (local.get $answer))
    (call $acm_driver_enum_continue))
  (func (export "test_get_esp") (result i32) (i32.load offset=16 (global.get $reg_base)))
  (func (export "test_set_esp") (param $v i32) (i32.store offset=16 (global.get $reg_base) (local.get $v)))
`;

// Windows/Wine IMA ADPCM block decode (imaadp32 process_nibble), interleaved
// 16-bit output.
const IMA_STEP = [7,8,9,10,11,12,13,14,16,17,19,21,23,25,28,31,34,37,41,45,50,55,60,66,73,80,88,97,107,
  118,130,143,157,173,190,209,230,253,279,307,337,371,408,449,494,544,598,658,724,796,876,963,1060,1166,
  1282,1411,1552,1707,1878,2066,2272,2499,2749,3024,3327,3660,4026,4428,4871,5358,5894,6484,7132,7845,
  8630,9493,10442,11487,12635,13899,15289,16818,18500,20350,22385,24623,27086,29794,32767];
const IMA_INDEX = [-1, -1, -1, -1, 2, 4, 6, 8];
function referenceImaDecode(fmt, data) {
  const ch = fmt.readUInt16LE(2), align = fmt.readUInt16LE(12), spb = fmt.readUInt16LE(18);
  const out = new Int16Array((data.length / align) * spb * ch);
  for (let b = 0; b * align < data.length; b++) {
    const blk = data.subarray(b * align, (b + 1) * align), base = b * spb * ch;
    for (let c = 0; c < ch; c++) {
      let s = blk.readInt16LE(c * 4), idx = Math.min(88, blk[c * 4 + 2]);
      out[base + c] = s;
      let pos = 1;
      for (let run = 0; run < (spb - 1) / 8; run++) {
        for (let j = 0; j < 8; j++) {
          const byte = blk[4 * ch + (run * ch + c) * 4 + (j >> 1)];
          const code = j & 1 ? byte >> 4 : byte & 15;
          const step = IMA_STEP[idx];
          let diff = step >> 3;
          if (code & 1) diff += step >> 2;
          if (code & 2) diff += step >> 1;
          if (code & 4) diff += step;
          s = Math.max(-32768, Math.min(32767, code & 8 ? s - diff : s + diff));
          idx = Math.max(0, Math.min(88, idx + IMA_INDEX[code & 7]));
          out[base + pos * ch + c] = s;
          pos++;
        }
      }
    }
  }
  return Buffer.from(out.buffer);
}

function parseWav(buf) {
  let off = 12, fmt = null, data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('latin1', off, off + 4), len = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = buf.subarray(off + 8, off + 8 + len);
    if (id === 'data') data = buf.subarray(off + 8, off + 8 + len);
    off += 8 + len + (len & 1);
  }
  return { fmt, data };
}

async function main() {
  const wasm = compileSrcWasm((file, source) =>
    file === '13-exports.wat' ? `${source}\n${extraWat}\n` : source);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = createHostImports({ getMemory: () => memory.buffer, renderer: null, resourceJson: {} });
  imports.host.memory = memory;
  Object.assign(imports.host, {
    create_thread: () => 0, exit_thread: () => 0, terminate_thread: () => 0,
    create_event: () => 0, set_event: () => 0, reset_event: () => 0,
    wait_single: () => 0, wait_multiple: () => 0, com_create_instance: () => 0x80004002,
  });
  const { instance } = await WebAssembly.instantiate(wasm, imports);
  const e = instance.exports;
  const exe = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'calc.exe'));
  new Uint8Array(memory.buffer).set(exe, e.get_staging());
  assert(e.load_pe(exe.length), 'fixture PE initializes guest memory');
  const imageBase = e.get_image_base() >>> 0;
  const guestBase = e.get_guest_base() >>> 0;
  const wa = guest => (guest - imageBase + guestBase) >>> 0;
  const mem = () => new Uint8Array(memory.buffer);
  const dv = () => new DataView(memory.buffer);
  const alloc = n => e.guest_alloc(n) >>> 0;
  const put = (guest, bytes) => mem().set(bytes, wa(guest));
  const u32 = guest => dv().getUint32(wa(guest), true);
  const OP = { size: 1, prepare: 2, convert: 3, unprepare: 4, close: 5, suggest: 6, details: 7, metrics: 8, tag: 9,
    driverOpen: 10, driverClose: 11 };

  // ---- drivers ----
  const metric = alloc(4);
  assert.strictEqual(e.test_acm_call(OP.metrics, 1, metric, 0, 0, 0), 0);
  assert.strictEqual(u32(metric), 3, 'three drivers: PCM converter, MS-ADPCM, IMA ADPCM');
  assert.strictEqual(e.test_acm_call(OP.metrics, 2, metric, 0, 0, 0), 0);
  assert.strictEqual(u32(metric), 2, 'two of them are codecs');
  assert.strictEqual(e.test_acm_call(OP.metrics, 50, metric, 0, 0, 0), 0);
  assert.strictEqual(u32(metric), 50, 'ACM_METRIC_MAX_SIZE_FORMAT fits an MS-ADPCM WAVEFORMATEX');

  const details = alloc(920);
  const shortName = () => Buffer.from(mem().subarray(wa(details) + 40, wa(details) + 72)).toString('latin1').replace(/\0.*$/s, '');
  const longName = () => Buffer.from(mem().subarray(wa(details) + 72, wa(details) + 200)).toString('latin1').replace(/\0.*$/s, '');
  const names = [];
  for (const id of [0x0ACD0001, 0x0ACD0002, 0x0ACD0003]) {
    dv().setUint32(wa(details), 920, true);
    assert.strictEqual(e.test_acm_call(OP.details, id, details, 0, 0, 0), 0, `details of 0x${id.toString(16)}`);
    names.push(`${shortName()} / ${longName()}`);
  }
  assert.deepStrictEqual(names, ['MS-PCM / Microsoft PCM Converter',
    'MS-ADPCM / Microsoft ADPCM CODEC', 'MS-IMA ADPCM / Microsoft IMA ADPCM CODEC'],
  'Tomb Raider III finds the MS-ADPCM codec by its short name');
  assert.strictEqual(e.test_acm_call(OP.details, 0x0ACD0004, details, 0, 0, 0), 5, 'unknown driver id');

  // Enumeration visits every driver while the callback returns TRUE, stops
  // at the first FALSE, and returns MMSYSERR_NOERROR to the caller.
  const baseEsp = e.test_get_esp() >>> 0;
  const callerEsp = e.test_acm_enum_start(0x00402000, 0xBEEF) >>> 0;
  const seen = [];
  for (let round = 0; round < 4; round++) {
    const sp = e.test_get_esp() >>> 0;
    assert.strictEqual(e.get_eip() >>> 0, 0x00402000, 'callback is called');
    seen.push(u32(sp + 4));
    assert.strictEqual(u32(sp + 8), 0xBEEF, 'dwInstance passes through');
    if (seen.length === 3) { e.test_acm_enum_callback_returns(1); break; }
    e.test_acm_enum_callback_returns(1);
  }
  assert.deepStrictEqual(seen, [0x0ACD0001, 0x0ACD0002, 0x0ACD0003]);
  assert.strictEqual(e.get_eip() >>> 0, 0x00401234, 'returns to the caller after the last driver');
  assert.strictEqual(e.test_get_esp() >>> 0, callerEsp + 16, 'stdcall frame of three arguments popped');
  e.test_set_esp(baseEsp);
  e.test_acm_enum_start(0x00402000, 0);
  e.test_acm_enum_callback_returns(0);                     // stop at the PCM converter
  assert.strictEqual(e.get_eip() >>> 0, 0x00401234, 'FALSE stops enumeration');
  e.test_set_esp(baseEsp);

  // Format tags
  const tag = alloc(156);
  dv().setUint32(wa(tag), 156, true);
  dv().setUint32(wa(tag) + 8, 2, true);
  assert.strictEqual(e.test_acm_call(OP.tag, tag, 1, 0, 0, 0), 0, 'FORMATTAG query for MS-ADPCM');
  assert.strictEqual(u32(tag + 12), 50);
  dv().setUint32(wa(tag) + 4, 2, true);
  assert.strictEqual(e.test_acm_call(OP.tag, tag, 0, 0, 0, 0), 0, 'INDEX query, third tag');
  assert.strictEqual(u32(tag + 8), 0x11, 'IMA ADPCM');

  // ---- decode ----
  for (const [name, v] of Object.entries(VECTORS)) {
    const { fmt, data } = parseWav(Buffer.from(v.wav, 'base64'));
    const src = alloc(fmt.length + 8); put(src, fmt);
    const ch = fmt.readUInt16LE(2), rate = fmt.readUInt32LE(4);

    // acmFormatSuggest proposes 16-bit PCM at the source's rate and channels.
    const sugg = alloc(18);
    assert.strictEqual(e.test_acm_call(OP.suggest, src, sugg, 18, 0, 0), 0, `${name}: suggest`);
    assert.deepStrictEqual([dv().getUint16(wa(sugg), true), dv().getUint16(wa(sugg) + 2, true),
      u32(sugg + 4), u32(sugg + 8), dv().getUint16(wa(sugg) + 12, true), dv().getUint16(wa(sugg) + 14, true)],
    [1, ch, rate, rate * ch * 2, ch * 2, 16], `${name}: suggested PCM`);
    // A pinned 8-bit destination is one msadp32/imaadp32 also decode to.
    dv().setUint16(wa(sugg) + 14, 8, true);
    assert.strictEqual(e.test_acm_call(OP.suggest, src, sugg, 18, 0x80000, 0), 0);
    assert.deepStrictEqual([u32(sugg + 8), dv().getUint16(wa(sugg) + 12, true), dv().getUint16(wa(sugg) + 14, true)],
      [rate * ch, ch, 8], `${name}: suggested 8-bit PCM`);
    dv().setUint16(wa(sugg) + 14, 12, true);
    assert.strictEqual(e.test_acm_call(OP.suggest, src, sugg, 18, 0x80000, 0), 512, 'nor any other depth');
    e.test_acm_call(OP.suggest, src, sugg, 18, 0, 0);

    const phas = alloc(4);
    assert.strictEqual(e.test_acm_stream_open(phas, src, sugg, 1) >>> 0, 0, `${name}: QUERY`);
    assert.strictEqual(e.test_acm_stream_open(phas, src, sugg, 2) >>> 0, 512, `${name}: no async`);
    assert.strictEqual(e.test_acm_stream_open(phas, src, sugg, 0) >>> 0, 0, `${name}: open`);
    const has = u32(phas);
    assert(has, 'stream handle');

    const out = alloc(4);
    assert.strictEqual(e.test_acm_call(OP.size, has, data.length, out, 0, 0), 0);
    assert.strictEqual(u32(out), v.pcmBytes, `${name}: acmStreamSize(SOURCE)`);
    assert.strictEqual(e.test_acm_call(OP.size, has, v.pcmBytes, out, 1, 0), 0);
    assert.strictEqual(u32(out), data.length, `${name}: acmStreamSize(DESTINATION)`);
    dv().setUint32(wa(out), 0x8D659, true);   // stale caller stack, as FreeSpace's streamer had
    assert.strictEqual(e.test_acm_call(OP.size, has, 10, out, 0, 0), 512, 'less than one block');
    assert.strictEqual(u32(out), 0, 'NOTPOSSIBLE still clears *pdwOutputBytes (SOURCE)');
    dv().setUint32(wa(out), 0x8D659, true);
    assert.strictEqual(e.test_acm_call(OP.size, has, 1792, out, 1, 0), 512, 'DESTINATION under one block');
    assert.strictEqual(u32(out), 0, 'NOTPOSSIBLE still clears *pdwOutputBytes (DESTINATION)');

    const pbSrc = alloc(data.length + 1); put(pbSrc, data);
    const pbDst = alloc(v.pcmBytes + 64);
    const hdr = alloc(84);
    mem().fill(0, wa(hdr), wa(hdr) + 84);
    dv().setUint32(wa(hdr), 84, true);
    dv().setUint32(wa(hdr) + 12, pbSrc, true);
    dv().setUint32(wa(hdr) + 16, data.length + 1, true);   // a trailing partial block is left alone
    dv().setUint32(wa(hdr) + 28, pbDst, true);
    dv().setUint32(wa(hdr) + 32, v.pcmBytes + 64, true);
    assert.strictEqual(e.test_acm_call(OP.convert, has, hdr, 0, 0, 0), 514, 'convert needs a prepared header');
    assert.strictEqual(e.test_acm_call(OP.prepare, has, hdr, 0, 0, 0), 0);
    assert.strictEqual(u32(hdr + 4) & 0x20000, 0x20000, 'PREPARED');
    assert.strictEqual(e.test_acm_call(OP.convert, has, hdr, 0x34, 0, 0), 0, `${name}: convert`);
    assert.strictEqual(u32(hdr + 20), data.length, `${name}: whole blocks consumed`);
    assert.strictEqual(u32(hdr + 36), v.pcmBytes, `${name}: PCM produced`);
    assert.strictEqual(u32(hdr + 4) & 0x10000, 0x10000, 'DONE');
    const pcm = Buffer.from(mem().subarray(wa(pbDst), wa(pbDst) + v.pcmBytes));
    const first = () => Array.from(new Int16Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + 16))).join(',');
    if (!v.ffmpegPcm) {
      const sha = crypto.createHash('sha256').update(pcm).digest('hex');
      if (sha !== v.ffmpegSha256) assert.fail(`${name}: decode differs from ffmpeg's (first samples ${first()})`);
    } else {
      assert(pcm.equals(referenceImaDecode(fmt, data)),
        `${name}: decode differs from the Windows IMA reference (first samples ${first()})`);
      const ff = Buffer.from(v.ffmpegPcm, 'base64');
      let maxDiff = 0;
      for (let i = 0; i < pcm.length; i += 2) maxDiff = Math.max(maxDiff, Math.abs(pcm.readInt16LE(i) - ff.readInt16LE(i)));
      assert(maxDiff <= 64, `${name}: ${maxDiff} LSB from ffmpeg's decode (layout or nibble order wrong?)`);
      v.note = `within ${maxDiff} LSB of ffmpeg`;
    }
    // The same blocks decoded to 8-bit PCM (FreeSpace's request): one byte
    // per sample, the 16-bit sample's high byte offset to unsigned.
    {
      const dst8 = alloc(18);
      mem().copyWithin(wa(dst8), wa(sugg), wa(sugg) + 18);
      dv().setUint32(wa(dst8) + 8, rate * ch, true);
      dv().setUint16(wa(dst8) + 12, ch, true);
      dv().setUint16(wa(dst8) + 14, 8, true);
      const ph8 = alloc(4);
      assert.strictEqual(e.test_acm_stream_open(ph8, src, dst8, 0) >>> 0, 0, `${name}: open to 8-bit PCM`);
      const h8 = u32(ph8);
      assert.strictEqual(e.test_acm_call(OP.size, h8, data.length, out, 0, 0), 0);
      assert.strictEqual(u32(out), v.pcmBytes / 2, `${name}: 8-bit acmStreamSize(SOURCE)`);
      const out8 = alloc(v.pcmBytes / 2 + 8);
      const hdr8 = alloc(84);
      mem().fill(0, wa(hdr8), wa(hdr8) + 84);
      dv().setUint32(wa(hdr8), 84, true);
      dv().setUint32(wa(hdr8) + 12, pbSrc, true);
      dv().setUint32(wa(hdr8) + 16, data.length, true);
      dv().setUint32(wa(hdr8) + 28, out8, true);
      dv().setUint32(wa(hdr8) + 32, v.pcmBytes / 2, true);   // exactly the 8-bit size
      mem().fill(0xEE, wa(out8) + v.pcmBytes / 2, wa(out8) + v.pcmBytes / 2 + 8);
      assert.strictEqual(e.test_acm_call(OP.prepare, h8, hdr8, 0, 0, 0), 0);
      assert.strictEqual(e.test_acm_call(OP.convert, h8, hdr8, 0x34, 0, 0), 0, `${name}: 8-bit convert`);
      assert.strictEqual(u32(hdr8 + 36), v.pcmBytes / 2, `${name}: 8-bit bytes produced`);
      const got = mem().subarray(wa(out8), wa(out8) + v.pcmBytes / 2);
      for (let s = 0; s < got.length; s++) {
        const want = ((pcm.readInt16LE(s * 2) >> 8) + 128) & 0xFF;
        if (got[s] !== want) assert.fail(`${name}: 8-bit sample ${s} is ${got[s]}, want ${want}`);
      }
      assert(mem().subarray(wa(out8) + v.pcmBytes / 2, wa(out8) + v.pcmBytes / 2 + 8).every(b => b === 0xEE),
        `${name}: nothing written past the 8-bit buffer`);
      assert.strictEqual(e.test_acm_call(OP.unprepare, h8, hdr8, 0, 0, 0), 0);
      assert.strictEqual(e.test_acm_call(OP.close, h8, 0, 0, 0, 0), 0);
    }
    assert.strictEqual(e.test_acm_call(OP.unprepare, has, hdr, 0, 0, 0), 0);
    assert.strictEqual(e.test_acm_call(OP.unprepare, has, hdr, 0, 0, 0), 514, 'already unprepared');
    assert.strictEqual(e.test_acm_call(OP.close, has, 0, 0, 0, 0), 0);
    assert.strictEqual(e.test_acm_call(OP.close, has, 0, 0, 0, 0), 5, 'closed handle is invalid');
    console.log(v.note
      ? `PASS ${name}: ${v.pcmBytes} bytes of PCM match the Windows IMA reference, ${v.note}`
      : `PASS ${name}: ${v.pcmBytes} bytes of PCM match ffmpeg's decode`);
  }

  // A PCM destination at another rate needs a resampler the codecs lack.
  const { fmt } = parseWav(Buffer.from(VECTORS.ms_mono.wav, 'base64'));
  const src = alloc(fmt.length); put(src, fmt);
  const dst = alloc(18);
  e.test_acm_call(OP.suggest, src, dst, 18, 0, 0);
  dv().setUint32(wa(dst) + 4, 22050, true);
  assert.strictEqual(e.test_acm_stream_open(alloc(4), src, dst, 0) >>> 0, 512, 'no resampling');

  // Tomb Raider III opens the codec it found and streams through that handle.
  dv().setUint32(wa(dst) + 4, fmt.readUInt32LE(4), true);
  const phad = alloc(4);
  assert.strictEqual(e.test_acm_call(OP.driverOpen, phad, 0x0ACD0002, 0, 0, 0), 0, 'open MS-ADPCM');
  const msHad = u32(phad);
  assert.strictEqual(e.test_acm_call(OP.driverOpen, phad, 0x0ACD0001, 0, 0, 0), 0, 'open PCM converter');
  const pcmHad = u32(phad);
  assert.strictEqual(e.test_acm_call(OP.driverOpen, phad, 0x0ACD0009, 0, 0, 0), 5, 'unknown driver id');
  const ph = alloc(4);
  assert.strictEqual(e.test_acm_stream_open_had(ph, msHad, src, dst) >>> 0, 0, 'stream through the MS-ADPCM codec');
  assert.strictEqual(e.test_acm_call(OP.close, u32(ph), 0, 0, 0, 0), 0);
  assert.strictEqual(e.test_acm_stream_open_had(ph, pcmHad, src, dst) >>> 0, 512,
    'the PCM converter does not decode ADPCM');
  assert.strictEqual(e.test_acm_call(OP.driverClose, msHad, 0, 0, 0, 0), 0);
  assert.strictEqual(e.test_acm_call(OP.driverClose, pcmHad, 0, 0, 0, 0), 0);
  assert.strictEqual(e.test_acm_call(OP.driverClose, 0x1234, 0, 0, 0, 0), 5, 'invalid driver handle');

  // ---- acmDriverPriority (FreeSpace calls it after enumerating the codecs) ----
  const PRIO = 12, MS = 0x0ACD0002, IMA = 0x0ACD0003;
  const enumAll = fdw => {
    const ids = [];
    const start = e.test_get_esp() >>> 0;
    const caller = e.test_acm_enum_start_fdw(0x00402000, 0, fdw) >>> 0;
    while ((e.get_eip() >>> 0) === 0x00402000) {
      const sp = e.test_get_esp() >>> 0;
      ids.push(u32(sp + 4));
      e.test_acm_enum_callback_returns(1);
    }
    assert.strictEqual(e.get_eip() >>> 0, 0x00401234, 'enumeration returns to its caller');
    assert.strictEqual(e.test_get_esp() >>> 0, caller + 16, 'and pops its three arguments');
    e.test_set_esp(start);
    return ids;
  };
  assert.strictEqual(e.test_acm_call(PRIO, MS, 0, 0x4, 0, 0), 10, 'unknown flag');
  assert.strictEqual(e.test_acm_call(PRIO, MS, 0, 0x3, 0, 0), 10, 'ENABLE with DISABLE');
  assert.strictEqual(e.test_acm_call(PRIO, 0, 0, 0x30000, 0, 0), 10, 'BEGIN with END');
  assert.strictEqual(e.test_acm_call(PRIO, MS, 0, 0x10000, 0, 0), 11, 'BEGIN names no driver');
  assert.strictEqual(e.test_acm_call(PRIO, 0, 1, 0x20000, 0, 0), 11, 'END carries no priority');
  assert.strictEqual(e.test_acm_call(PRIO, 0, 0, 0x10000, 0, 0), 0, 'BEGIN alone');
  assert.strictEqual(e.test_acm_call(PRIO, 0, 0, 0x20000, 0, 0), 0, 'END alone');
  assert.strictEqual(e.test_acm_call(PRIO, 0x0ACD0009, 0, 0, 0, 0), 5, 'unknown driver id');
  assert.strictEqual(e.test_acm_call(PRIO, MS, 4, 0, 0, 0), 11, 'priority past the last driver');
  assert.strictEqual(e.test_acm_call(PRIO, MS, 0, 0, 0, 0), 0, 'no change at all is fine');

  assert.strictEqual(e.test_acm_call(PRIO, MS, 0, 0x2, 0, 0), 0, 'disable MS-ADPCM');
  assert.strictEqual(e.test_acm_call(OP.details, MS, details, 0, 0, 0), 0);
  assert.strictEqual(u32(details + 24) >>> 0, 0x80000001, 'details report CODEC | DISABLED');
  assert.deepStrictEqual(enumAll(0), [0x0ACD0001, IMA], 'a disabled driver is not enumerated');
  assert.deepStrictEqual(enumAll(0x80000000), [0x0ACD0001, MS, IMA], 'unless DISABLED is asked for');
  assert.strictEqual(e.test_acm_call(OP.driverOpen, phad, MS, 0, 0, 0), 12, 'MMSYSERR_NOTENABLED');
  assert.strictEqual(e.test_acm_stream_open_had(ph, 0, src, dst) >>> 0, 512,
    'no enabled codec for MS-ADPCM: ACMERR_NOTPOSSIBLE');
  assert.strictEqual(e.test_acm_call(PRIO, MS, 0, 0x1, 0, 0), 0, 'enable it again');
  assert.strictEqual(e.test_acm_stream_open_had(ph, 0, src, dst) >>> 0, 0, 'and it converts again');
  assert.strictEqual(e.test_acm_call(OP.close, u32(ph), 0, 0, 0, 0), 0);

  assert.strictEqual(e.test_acm_call(PRIO, IMA, 1, 0, 0, 0), 0, 'IMA ADPCM first');
  assert.deepStrictEqual(enumAll(0), [IMA, 0x0ACD0001, MS], 'enumeration follows priority');
  assert.strictEqual(e.test_acm_call(PRIO, IMA, 0xFFFFFFFF, 0, 0, 0), 0, '-1: lowest');
  assert.deepStrictEqual(enumAll(0), [0x0ACD0001, MS, IMA], 'back to the boot order');

  console.log('PASS ACM drivers, enumeration, format tags, suggestion and stream errors');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
