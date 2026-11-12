# NFS II SE original installer reference attempt (2026-10-28)

Historical source last updated, 2026-10-28. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

**Blocked before the original installer ran.** The native compatibility package
operation was rejected by its aggregate CPU90 guard. No ISO was downloaded on
this task's Boat, no Wine prefix was created, and no game installer or game
executable was invoked. There is no generated `INSTALL.WIN`, configuration,
save, registry, installed-file inventory, or installer UI result to qualify.

This is the bounded prerequisite for `GAMEPLAY-need-for-speed-2-se-full`, not
the historical Claude `NFS2SE-INSTALL-ICON-VERIFY` assignment. It provides no
registration, project build, browser execution, or gameplay acceptance.

## Actual native preparation and first blocker

The first package simulation could not locate `wine32:i386` before enabling
i386 metadata. With metadata present, the next simulation found a multiarch
version conflict: installed amd64 `libgd3` was
`2.3.3-13+ubuntu24.04.1+deb.sury.org+1` from the existing PHP PPA, while Ubuntu's
i386 candidate was `2.3.3-9ubuntu5`. A changed simulation explicitly selecting
Ubuntu's matching `libgd3` pair succeeded with zero removals. Selecting only
32-bit Wine avoided an unnecessary amd64 Wine installation.

The exact final payload plan was obtained without downloading packages:

```sh
apt-get --print-uris --download-only --assume-yes --allow-downgrades \
  --no-install-recommends install wine wine32:i386 xvfb \
  libgd3=2.3.3-9ubuntu5 libgd3:i386=2.3.3-9ubuntu5
```

```sh
sudo -n env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l \
  apt-get -y --allow-downgrades --no-install-recommends \
  -o Acquire::Retries=0 -o Acquire::http::Timeout=35 \
  -o Acquire::https::Timeout=35 install wine wine32:i386 xvfb \
  libgd3=2.3.3-9ubuntu5 libgd3:i386=2.3.3-9ubuntu5
```

| Package operation result | Recorded value |
| --- | ---: |
| Stop reason | `aggregate CPU limit` |
| Supervised child exit | `-15` |
| Boat detached command exit | `1` |
| Accounted CPU seconds | 126.655995 |
| Wall seconds | 46.489179183999966 |
| Peak sampled aggregate RSS bytes | 442646528 |
| Cleanup complete | true |

The supervisor conservatively accounts observed own and waited CPU; its
accounted total is not an exact unduplicated workload CPU measurement. Its
CPU90 rejection remains authoritative. No guard was reset and no Wine,
package repair, installer, alternate runtime, or unchanged retry followed it.

## Retention and unfulfilled acceptance

Canonical private receipt:
`scratch/usage-watch/nfs2se-original-installer-output-oct28/receipt.json`. It binds the predecessor, source/configuration and tool identities, package
plans, exact guard outcome, diagnostic hashes, publication and cleanup. The remote evidence archive SHA-256 is
`fb4a2eb34f6ab0fc6a7c6838cbdcb770104c79f11e36fba62c3d06fac9c47bdc`;
its 45 sealed evidence files were individually verified after transfer.

Private remote state is retained at
`/home/user/nfs2se-original-installer-output-oct28` on `bx_nnnajdp9`. The archive contains preparation scripts, package identities, plans and
diagnostics, not commercial media or installed game files. There is no
generated-file hash or actual installed software-game identity in this task. Installer stdout/stderr/exit, UI status, before/after game registry/file
inventories, defaults, CD/path dependencies and a successful reproducible
reference installation recipe all remain **unfulfilled**.
