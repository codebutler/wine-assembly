# Stock icons

The system's stock icons (`LoadIcon(NULL, IDI_*)`, `LoadImage(NULL, OIC_*)`)
are Wine's own, from `dlls/user32/resources/` at Wine commit
[`4e819f054dd2d9ee855ee3f1e30d8c1bb8f80fcf`](https://gitlab.winehq.org/wine/wine/-/commit/4e819f054dd2d9ee855ee3f1e30d8c1bb8f80fcf),
downloaded from the official Wine GitLab repository on 2026-09-26. They are
LGPL-2.1, like the rest of Wine; the license text is `fonts/Wine-LGPL-2.1.txt`.

| File | Id | SHA-256 |
|---|---|---|
| `oic_sample.ico` | `IDI_APPLICATION` / `OIC_SAMPLE` (32512) | `71638db3181fcba3f155d00268ce76c54a7a8c552ead35bc9623262425f81e2f` |
| `oic_hand.ico` | `IDI_HAND` / `OIC_HAND` (32513) | `2e078c4e5ebf2f0d4986d6461b4de24c030d13bd638a1606461d354b3a4e6fe5` |
| `oic_ques.ico` | `IDI_QUESTION` / `OIC_QUES` (32514) | `8d770b297c25e39e56fc8c2588bc161256e13415d6bd76cbc2be0df0994937ad` |
| `oic_bang.ico` | `IDI_EXCLAMATION` / `OIC_BANG` (32515) | `874b1d41239d4a1796eaa4f777754f47a952f944f99bfa6fe3afd9db24a7d3e9` |
| `oic_note.ico` | `IDI_ASTERISK` / `OIC_NOTE` (32516) | `faade30c88e213b1ed1d52f8756d9c5b0030ea106c604d95ddd3869ff5bd8caf` |
| `oic_winlogo.ico` | `IDI_WINLOGO` / `OIC_WINLOGO` (32517) | `358d0880a9fd5cdef946753364f0e3ca8a550e356e616c9dda325000d4ec4306` |

Each file carries 16, 32 and 48px images at 4, 8 and 32 bits per pixel (and
a 256px PNG). The engine draws the 16 or 32px image at 8 bits per pixel or
fewer, the depth a Windows 98 display of the time would have picked. The
hosts mount them at `C:\WINDOWS\SYSTEM\OIC_*.ICO` (`STOCK_ICON_FILES` in
`lib/process-boot.js`), and the engine reads them the first time one is drawn.

`IDI_WINLOGO` is Wine's glass rather than a Windows flag, which is as it
should be.
