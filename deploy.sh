#!/bin/bash
export PATH="/opt/homebrew/bin:$PATH"

MAIN_REPO="/Users/adickinson/Documents/GitHub/V0"
WORKTREE_DIR="/Users/adickinson/.claude-worktrees/V0"
DOWNLOADS="/Users/adickinson/Downloads"

cd "$MAIN_REPO"
git checkout develop

CHANGES_FOUND=false

# 1. Check Downloads folder first (original behavior)
if [ -f "$DOWNLOADS/App.jsx" ]; then
  mv "$DOWNLOADS/App.jsx" ./src/
  git add src/App.jsx
  echo "✓ Moved App.jsx from Downloads"
  CHANGES_FOUND=true
fi
if [ -f "$DOWNLOADS/data.js" ]; then
  mv "$DOWNLOADS/data.js" ./src/
  git add src/data.js
  echo "✓ Moved data.js from Downloads"
  CHANGES_FOUND=true
fi

# 2. Check for active worktrees with changes
if [ "$CHANGES_FOUND" = false ] && [ -d "$WORKTREE_DIR" ]; then
  echo "📂 Checking worktrees for changes..."

  # Find the most recently modified worktree
  LATEST_WORKTREE=$(ls -t "$WORKTREE_DIR" 2>/dev/null | head -1)

  if [ -n "$LATEST_WORKTREE" ] && [ -d "$WORKTREE_DIR/$LATEST_WORKTREE/src" ]; then
    WORKTREE_PATH="$WORKTREE_DIR/$LATEST_WORKTREE"

    # Check if worktree has different App.jsx
    if [ -f "$WORKTREE_PATH/src/App.jsx" ]; then
      if ! diff -q "$MAIN_REPO/src/App.jsx" "$WORKTREE_PATH/src/App.jsx" > /dev/null 2>&1; then
        echo "📦 Found changes in worktree: $LATEST_WORKTREE"

        # Prompt user to confirm
        RESPONSE=$(osascript -e "display dialog \"Found changes in worktree '$LATEST_WORKTREE'.\n\nDeploy these changes to develop?\" buttons {\"Cancel\", \"Deploy\"} default button \"Deploy\" with title \"OpenOnco Deploy\"" 2>/dev/null)

        if [[ "$RESPONSE" == *"Deploy"* ]]; then
          cp "$WORKTREE_PATH/src/App.jsx" ./src/
          git add src/App.jsx
          echo "✓ Copied App.jsx from worktree: $LATEST_WORKTREE"
          CHANGES_FOUND=true
        else
          echo "Cancelled by user"
          exit 0
        fi
      fi
    fi

    # Check if worktree has different data.js
    if [ -f "$WORKTREE_PATH/src/data.js" ]; then
      if ! diff -q "$MAIN_REPO/src/data.js" "$WORKTREE_PATH/src/data.js" > /dev/null 2>&1; then
        cp "$WORKTREE_PATH/src/data.js" ./src/
        git add src/data.js
        echo "✓ Copied data.js from worktree: $LATEST_WORKTREE"
        CHANGES_FOUND=true
      fi
    fi
  fi
fi

# 3. Stage any other changes in the repo
git add -A

# Check if there are any changes to commit
if git diff --cached --quiet; then
  osascript -e 'display dialog "⚠️ No changes to deploy.\n\nOptions:\n• Drop App.jsx or data.js in Downloads\n• Make changes in a Claude Code worktree\n• Edit files directly in the repo" with title "OpenOnco Deploy" buttons {"OK"} default button "OK" with icon caution'
  exit 1
fi

# Show what's being deployed
echo "📦 Changes to deploy:"
git diff --cached --name-only

# Run smoke tests before deploying
if ! npx playwright test -g "Homepage|Category Pages" --reporter=list; then
  osascript -e 'display dialog "❌ Deploy BLOCKED - Tests Failed!\n\nRun this to debug:\nnpx playwright test --headed\n\nFix the issue before deploying." with title "OpenOnco Tests Failed" buttons {"OK"} default button "OK" with icon stop'
  exit 1
fi

git commit -m "Update app"
git push
sleep 15
URL=$(/opt/homebrew/bin/vercel ls 2>/dev/null | grep -o 'https://[^[:space:]]*\.vercel\.app' | head -1)
osascript -e "display dialog \"✅ Tests passed! Preview URL: $URL\" buttons {\"Open\", \"OK\"} default button \"Open\""
if [ $? -eq 0 ]; then
    open "$URL"
fi
