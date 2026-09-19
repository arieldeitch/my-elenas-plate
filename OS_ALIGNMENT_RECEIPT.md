# OS Alignment Receipt — Control Tower pointer

Project: **P-005 Nutrition App** · Control Tower is the evidence owner of OS alignment; the canonical OS is the rule owner.
Protocol: `arieldeitch/ai-project-management-platform` → `docs/control-tower/OS_ALIGNMENT_RECEIPT_PROTOCOL.md`.

At the start of every substantial run:
1. Read the canonical OS entry point (Drive `AI Projects/00_AI_Operating_System/AI_OS_START_HERE`) and note the current OS version and change marker.
2. Record the receipt (token comes from the environment only — never from this repo):
   ```
   node <ai-project-management-platform>/scripts/control-tower/os-receipt.mjs --project P-005 \
        --marker <OS change marker read> --version <OS version> --evidence <URL of this run's report>
   ```
   If the OS could not be read: add `--access-failed --notes "<why>"`.
3. No token on this machine → the script does nothing; write "OS sync not re-verified" in the run report.

Never copy the OS into this repository. Commits, pushes and Control Tower checks are not alignment evidence;
the board stays `UNKNOWN` / `NEVER_SEEN` until a receipt exists.
