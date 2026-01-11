#!/bin/bash

# kk - Context recovery for OpenOnco development
# Outputs recent git state for Claude to analyze

cd /Users/adickinson/Documents/GitHub/V0

echo "📋 OPENONCO CONTEXT RECOVERY"
echo "============================"
echo ""
echo "BRANCH: $(git branch --show-current)"
echo ""
echo "LAST 10 COMMITS:"
git log --oneline -10
echo ""
echo "UNCOMMITTED CHANGES:"
git status --short || echo "None"
echo ""
echo "FILES CHANGED (last 3 commits):"
git diff --stat HEAD~3 2>/dev/null | tail -10
echo ""
echo "============================"
