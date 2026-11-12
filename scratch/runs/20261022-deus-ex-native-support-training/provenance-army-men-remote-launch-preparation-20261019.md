Accepted c26252c4:docs/re-notes/army-men-remote-launch-preparation-20261019.md

224: | mfc42.dll | 954640 | `73b4b8b26b9632d67fd0d5f631326cfe54fb0d00959423eb616adfb8001b0717`; original Army `DLLs/MFC42.DLL`, exact installed system copy |
225: | msvcrt.dll | 277776 | `befb0220cffdb1a440ab6b7b94638ea659a5e44cba615186eb8464dec1675e5e`; original Army `DLLs/MSVCRT.DLL`, exact installed system copy |
226: | comctl32.dll | 577808 | `28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4`; existing VC6 redistributable fixture documented in test/binaries/dlls/SOURCES.md |
227: | ole32.dll | 790528 | `bb487eb6c5ade54d5ae0352f75cec84b4f1cbbb8d9fca5b3718d813b4a0c938d`; existing local Explorer98 fixture4.71.2900 referenced in black-white-2 re-notes; exact archive extraction not independently reconstructed, local use only |
228:
229: New source-only `check-army-men-native-fixtures.js` uses the production graph
230: resolver/import detector and same physical search order. It finds exactly
