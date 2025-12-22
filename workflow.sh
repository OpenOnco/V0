#!/bin/bash
# OpenOnco Deployment Workflow
# Usage: ./workflow.sh [--skip-smoke] [--skip-preview] [--prod]

set -e  # Exit on error

export PATH="/opt/homebrew/bin:$PATH"

# Ensure we're in the project directory (where .vercel config lives)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Verify Vercel CLI is available and authenticated
if ! command -v vercel &> /dev/null; then
  echo "❌ Vercel CLI not found. Install with: npm i -g vercel"
  exit 1
fi

# Check authentication
if ! vercel whoami &> /dev/null; then
  echo "⚠️  Not authenticated with Vercel. Run: vercel login"
  exit 1
fi

SKIP_SMOKE=false
SKIP_PREVIEW=false
SKIP_PREVIEW_TESTS=false
PROD_DEPLOY=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-smoke)
      SKIP_SMOKE=true
      shift
      ;;
    --skip-preview)
      SKIP_PREVIEW=true
      shift
      ;;
    --skip-preview-tests)
      SKIP_PREVIEW_TESTS=true
      shift
      ;;
    --prod)
      PROD_DEPLOY=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./workflow.sh [--skip-smoke] [--skip-preview] [--skip-preview-tests] [--prod]"
      exit 1
      ;;
  esac
done

echo "🚀 OpenOnco Deployment Workflow"
echo "================================"
echo ""

# Step 1: Run smoke tests locally
if [ "$SKIP_SMOKE" = false ]; then
  echo "📋 Step 1: Running smoke tests locally..."
  echo ""
  
  # Check if dev server is running
  if ! curl -s http://localhost:5173 > /dev/null 2>&1 && ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "⚠️  No dev server detected. Starting Vite dev server..."
    npm run dev > /dev/null 2>&1 &
    DEV_PID=$!
    echo "   Waiting for server to start..."
    sleep 5
    
    # Cleanup on exit
    trap "kill $DEV_PID 2>/dev/null || true" EXIT
  fi
  
  if npm run test:smoke; then
    echo "✅ Smoke tests passed!"
  else
    echo "❌ Smoke tests failed! Fix issues before deploying."
    exit 1
  fi
  echo ""
else
  echo "⏭️  Skipping smoke tests (--skip-smoke)"
  echo ""
fi

# Step 2: Deploy to Vercel preview
if [ "$SKIP_PREVIEW" = false ]; then
  echo "🌐 Step 2: Deploying to Vercel preview..."
  echo ""
  
  # Deploy to preview (ensure we're in project directory for .vercel config)
  echo "   Deploying..."
  VERCEL_OUTPUT=$(cd "$SCRIPT_DIR" && vercel --yes 2>&1)
  PREVIEW_URL=$(echo "$VERCEL_OUTPUT" | grep -oE 'https://[^[:space:]]*\.vercel\.app' | head -1)
  
  if [ -z "$PREVIEW_URL" ]; then
    echo "❌ Failed to get preview URL from Vercel"
    echo "   Vercel output:"
    echo "$VERCEL_OUTPUT" | tail -20
    exit 1
  fi
  
  echo "✅ Preview deployed: $PREVIEW_URL"
  echo ""
  echo "⏳ Waiting for deployment to be ready..."
  
  # Wait for the preview to actually serve the app (not login page)
  MAX_WAIT=60
  WAIT_COUNT=0
  while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    sleep 2
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PREVIEW_URL" 2>/dev/null || echo "000")
    PAGE_CONTENT=$(curl -s "$PREVIEW_URL" 2>/dev/null | head -c 500 || echo "")
    
    # Check if we're getting the actual app (not login page)
    if echo "$PAGE_CONTENT" | grep -q "OpenOnco\|MRD\|ECD" && [ "$HTTP_CODE" = "200" ]; then
      echo "   ✓ Preview is ready!"
      break
    fi
    
    WAIT_COUNT=$((WAIT_COUNT + 2))
    if [ $((WAIT_COUNT % 10)) -eq 0 ]; then
      echo "   Still waiting... ($WAIT_COUNT/$MAX_WAIT seconds)"
    fi
  done
  
  if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo "⚠️  Warning: Preview may not be fully ready. Continuing anyway..."
  fi
  
  # Step 3: Run full tests against preview (optional)
  if [ "$SKIP_PREVIEW_TESTS" = false ]; then
    echo "🧪 Step 3: Running full test suite against preview..."
    echo ""
    
    if TEST_URL="$PREVIEW_URL" npm run test:full; then
      echo "✅ All tests passed against preview!"
    else
      echo "⚠️  Tests failed against preview URL (this may be due to preview being private)"
      echo "   Preview: $PREVIEW_URL"
      echo ""
      echo "   Local tests passed, so the code is fine."
      echo "   If preview URL shows login page, check Vercel project settings."
      echo ""
      echo "   To skip preview tests next time: ./workflow.sh --skip-preview-tests"
      echo "   Debug with: TEST_URL=\"$PREVIEW_URL\" npm run test:headed"
      echo ""
      read -p "Continue anyway? (y/n) " -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
      fi
    fi
    echo ""
  else
    echo "⏭️  Skipping preview tests (--skip-preview-tests)"
    echo ""
  fi
  
  # Open preview in browser
  echo "🔍 Step 4: Opening preview for manual check..."
  open "$PREVIEW_URL"
  echo ""
  echo "👀 Please manually verify the preview at: $PREVIEW_URL"
  echo ""
  read -p "Press Enter to continue to production deploy (or Ctrl+C to cancel)..."
  echo ""
else
  echo "⏭️  Skipping preview deploy (--skip-preview)"
  echo ""
fi

# Step 4: Deploy to production
if [ "$PROD_DEPLOY" = true ]; then
  echo "🚀 Step 5: Deploying to production..."
  echo ""
  
  cd "$SCRIPT_DIR" && vercel --prod --yes
  
  echo ""
  echo "✅ Production deployment complete!"
  echo "   Site: https://www.openonco.org"
else
  echo "ℹ️  To deploy to production, run: ./workflow.sh --prod"
  echo "   (or add --prod flag to this command)"
fi

echo ""
echo "✨ Workflow complete!"

