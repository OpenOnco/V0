#!/bin/bash
set -e

# Watchdog: Verify Weekly OpenOnco Scan ran in last 8 days
# Checks for either a recent auto(weekly) commit or auto-scan tracking issue
# If neither found, alerts via GitHub issue → mailer webhook → email

RUN_LOG=""

append_log() {
  if [ -z "$RUN_LOG" ]; then
    RUN_LOG="$1"
  else
    RUN_LOG="${RUN_LOG}
$1"
  fi
}

# Compute 8 days ago date
if command -v gdate &>/dev/null; then
  EIGHT_DAYS_AGO=$(gdate -u -d '8 days ago' +%Y-%m-%d)
else
  EIGHT_DAYS_AGO=$(date -u -d '8 days ago' +%Y-%m-%d 2>/dev/null || date -u -v-8d +%Y-%m-%d)
fi

# ============================================================================
# CHECK 1: Recent commit on main with auto(weekly) marker
# ============================================================================

LAST_AUTO=$(git log --since="8 days ago" --grep='auto(weekly)' main --format='%ci %h %s' 2>/tmp/log_err.txt) || true

if [ -s /tmp/log_err.txt ]; then
  GIT_ERR=$(cat /tmp/log_err.txt)
  append_log "Git log error: $GIT_ERR"
fi

if [ -n "$LAST_AUTO" ]; then
  # Success: found recent auto(weekly) commit
  exit 0
fi

# ============================================================================
# CHECK 2: Tracking issue from last 8 days with auto-scan label
# ============================================================================

RECENT=$(gh issue list --label auto-scan --state all --limit 5 --search "created:>$EIGHT_DAYS_AGO" --json number,title 2>/tmp/gh_err.txt) || true

if [ -s /tmp/gh_err.txt ]; then
  GH_ERR=$(cat /tmp/gh_err.txt)
  append_log "GitHub CLI error: $GH_ERR"
fi

if [ -n "$RECENT" ] && [ "$RECENT" != "[]" ]; then
  # Success: found recent tracking issue
  exit 0
fi

# ============================================================================
# CHECK 3: Alert via mailer (neither check passed)
# ============================================================================

LAST_COMMIT=$(git log -1 --format='%ci %h %s' main 2>/dev/null || echo "(could not read git log)")

if [ -n "$RUN_LOG" ]; then
  TITLE="⚠️ WATCHDOG itself failed — $(date +%Y-%m-%d)"
  BODY="Watchdog run $(date -u +%Y-%m-%dT%H:%M:%SZ)

$RUN_LOG

The watchdog hit an error during its own checks (gh or git itself failing). The Weekly OpenOnco Scan may still be fine, or it may not be — the watchdog cannot tell. Check trigger run history at https://claude.ai/code/scheduled."
else
  TITLE="WATCHDOG: Weekly scan did not run — $(date +%Y-%m-%d)"
  BODY="The Weekly OpenOnco Scan did not produce a tracking issue or auto(weekly) commit in the last 8 days.

**Last commit on main:**
\`$LAST_COMMIT\`

The trigger likely timed out, errored, or was unscheduled. Check run history at https://claude.ai/code/scheduled and re-run manually if needed."
fi

printf '%s' "$BODY" > /tmp/mail-body.md

MAIL_URL=$(gh issue create --label mailer --title "$TITLE" --body-file /tmp/mail-body.md)
echo "Mailer issue created: $MAIL_URL"

MAIL_NUM="${MAIL_URL##*/}"
gh issue close "$MAIL_NUM" --reason completed >/dev/null || true

exit 0
