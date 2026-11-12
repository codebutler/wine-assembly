Recover the task/file-bundle-parser-accepted-integrate-oct26 branch using:

GIT_SSH_COMMAND="ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes"

Use a separate focused sparse checkout of host.js, lib/file-bundle.js, the seven
file-bundle parser/bounded-reader test paths listed in tested-inputs.json and this
review plus the retained independent-accept review. No dependency installation.
Verify evidence-manifest.json and tested-inputs.json. tests.json contains every
exact command (timeout55s, installed Node,16MiB heap, TAP reporter). Run each from
the repository root with an owned TMPDIR,24MiB file/128KiB output limits and fresh
resource admission. The rejecting-control file explicitly caps children at16MiB.
Resource allocations include checkout, owned Git/temp/evidence/session/launcher,
positive WAL growth once,24MiB future growth and8MiB reserve inside64MiB. Installed
Node and immutable borrowed object stores are standing inputs. No mounted files
or guest invocation exists, so mount argv validation is not applicable.

Main publication requires remote main still equal parent, passing merged tests,
task push and exact task verification, then normal fast-forward main push and
exact trusted ls-remote of both refs. Never force push. Root refs remain unchanged.
