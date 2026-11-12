Accepted c26252c4:docs/re-notes/black-white-2.md

817:
818: `PathGetCharTypeA/W` is now implemented from Microsoft's API contract and the
819: supplied native `test/binaries/explorer98/dlls/shlwapi.dll`, version5.00.2614.3500,
820: SHA256 `731b1ffdcb821a87e8ef1aa92fc956a0c385eaa6b8f4ad20c89db8b923f1aeae`.
821: Exports485/486 are70bdde1d/70bf16c2. Native disassembly classifies controls0–31,
822: quote, less/greater-than and pipe as0; space/comma/semicolon as1; star/question
823: as4; slash/colon/backslash as8; all remaining BYTE/WORD inputs as3. These are
