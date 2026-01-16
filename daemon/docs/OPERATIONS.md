# Operations Guide

This document covers deployment, monitoring, troubleshooting, and operational procedures for the OpenOnco Intelligence Daemon.

## Deployment

### Railway (Production)

The daemon is deployed on [Railway](https://railway.app) for production use.

#### Railway Configuration

The `railway.json` file:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

#### Initial Setup

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link to existing project (or create new with `railway init`)
railway link

# Set required environment variables
railway variables set RESEND_API_KEY=re_your_api_key_here
railway variables set DIGEST_RECIPIENT_EMAIL=team@openonco.com
railway variables set NODE_ENV=production

# Deploy
railway up

# Verify deployment
railway logs --tail
```

#### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key for email delivery |
| `DIGEST_RECIPIENT_EMAIL` | Primary recipient for digest emails |

#### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Set to `production` |
| `LOG_LEVEL` | `info` | Logging verbosity |
| `ALERT_EMAIL` | Same as digest | Critical alert recipient |
| `DIGEST_FROM_EMAIL` | `daemon@openonco.com` | Sender address |

See [CONFIGURATION.md](./CONFIGURATION.md) for all options.

#### Deployment Commands

```bash
# Deploy latest changes
railway up

# View deployment logs
railway logs --tail

# View last 100 lines
railway logs -n 100

# Check service status
railway status

# Restart service
railway service restart

# Set environment variable
railway variables set KEY=value

# View all variables
railway variables
```

---

## Local Mac Deployment (launchd)

For local development, testing, or as a backup monitoring instance, you can run the daemon as a macOS launchd service.

### Create the Launch Agent

Create `~/Library/LaunchAgents/com.openonco.daemon.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openonco.daemon</string>

    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/node</string>
        <string>/Users/YOUR_USERNAME/Documents/GitHub/V0/daemon/src/index.js</string>
    </array>

    <key>WorkingDirectory</key>
    <string>/Users/YOUR_USERNAME/Documents/GitHub/V0/daemon</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>RESEND_API_KEY</key>
        <string>re_your_api_key_here</string>
        <key>DIGEST_RECIPIENT_EMAIL</key>
        <string>team@openonco.com</string>
        <key>ALERT_EMAIL</key>
        <string>alerts@openonco.com</string>
        <key>LOG_LEVEL</key>
        <string>info</string>
    </dict>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>

    <key>StandardOutPath</key>
    <string>/Users/YOUR_USERNAME/Documents/GitHub/V0/daemon/logs/launchd-stdout.log</string>

    <key>StandardErrorPath</key>
    <string>/Users/YOUR_USERNAME/Documents/GitHub/V0/daemon/logs/launchd-stderr.log</string>

    <key>ThrottleInterval</key>
    <integer>60</integer>
</dict>
</plist>
```

**Important:** Replace `YOUR_USERNAME` with your actual macOS username.

**Note:** The node path may differ based on your installation:
- Homebrew ARM (Apple Silicon): `/opt/homebrew/bin/node`
- Homebrew Intel: `/usr/local/bin/node`
- Verify with: `which node`

### Managing the Launch Agent

```bash
# Load and start the daemon
launchctl load ~/Library/LaunchAgents/com.openonco.daemon.plist

# Stop and unload the daemon
launchctl unload ~/Library/LaunchAgents/com.openonco.daemon.plist

# Check if running
launchctl list | grep openonco

# View launchd logs
tail -f ~/Documents/GitHub/V0/daemon/logs/launchd-stdout.log
tail -f ~/Documents/GitHub/V0/daemon/logs/launchd-stderr.log

# View daemon application logs
tail -f ~/Documents/GitHub/V0/daemon/logs/daemon-$(date +%Y-%m-%d).log
```

### Troubleshooting launchd

```bash
# Verify plist syntax
plutil -lint ~/Library/LaunchAgents/com.openonco.daemon.plist

# Check for launchd errors
launchctl error <error_code>

# View system log for launch agent issues
log show --predicate 'senderImagePath contains "launchd"' --last 1h

# Check if node is accessible
/opt/homebrew/bin/node --version

# Test running manually first
cd ~/Documents/GitHub/V0/daemon
node src/index.js
```

### Common launchd Issues

| Issue | Solution |
|-------|----------|
| "Operation not permitted" | Grant Full Disk Access to Terminal in System Preferences |
| Service exits immediately | Check StandardErrorPath log for errors |
| Node not found | Verify node path with `which node` |
| Environment variables missing | Add all required vars to plist |

---

## Health Monitoring

### Health Data Structure

Health is tracked in `data/health.json`:

```json
{
  "version": 1,
  "startedAt": "2026-01-16T06:00:00.000Z",
  "lastUpdated": "2026-01-16T14:30:00.000Z",
  "crawlers": {
    "pubmed": {
      "lastRun": "2026-01-16T06:00:00.000Z",
      "lastSuccess": "2026-01-16T06:00:22.000Z",
      "discoveriesFound": 5,
      "discoveriesAdded": 3,
      "duration": 22396,
      "status": "success",
      "updatedAt": "2026-01-16T06:00:22.000Z"
    },
    "cms": { ... },
    "fda": { ... },
    "vendor": { ... },
    "preprints": { ... }
  },
  "errors": [
    {
      "source": "vendor",
      "message": "Timeout waiting for page",
      "stack": "...",
      "timestamp": "2026-01-15T09:00:45.000Z"
    }
  ],
  "digestsSent": 42,
  "lastDigestSent": "2026-01-16T10:00:05.000Z"
}
```

### Key Health Indicators

| Indicator | Healthy State |
|-----------|---------------|
| `lastSuccess` | Within scheduled interval |
| `status` | "success" |
| `errors` array | Empty or few recent entries |
| `discoveriesFound` | Non-zero periodically |
| `duration` | Stable, not increasing |

### Command-Line Health Checks

```bash
# View full health data
cat data/health.json | jq

# Check last successful crawl times
cat data/health.json | jq '.crawlers | to_entries[] | {crawler: .key, lastSuccess: .value.lastSuccess, status: .value.status}'

# Check for recent errors
cat data/health.json | jq '.errors | last(10)'

# Count pending discoveries
cat data/discoveries.json | jq '[.[] | select(.status == "pending")] | length'

# View discoveries by source
cat data/discoveries.json | jq 'group_by(.source) | map({source: .[0].source, count: length})'
```

### Programmatic Health Check

```javascript
import { getHealthSummary } from './src/health.js';
import { getQueueStatus } from './src/queue/index.js';

const health = await getHealthSummary();
console.log('Uptime:', health.uptime);
console.log('Recent errors:', health.recentErrorCount);
console.log('Crawlers:', health.crawlers);

const queue = getQueueStatus();
console.log('Pending reviews:', queue.pending);
console.log('Total discoveries:', queue.total);
```

---

## Logging

### Log Files

Logs are stored in the `logs/` directory:

| File Pattern | Content | Retention |
|--------------|---------|-----------|
| `daemon-YYYY-MM-DD.log` | All logs (info, warn, debug) | 14 days |
| `daemon-error-YYYY-MM-DD.log` | Errors only | 30 days |
| `daemon-exceptions-YYYY-MM-DD.log` | Uncaught exceptions | 30 days |

### Log Format (JSON)

```json
{
  "timestamp": "2026-01-16 06:00:00.123",
  "level": "info",
  "source": "crawler:pubmed",
  "message": "[PubMed] Starting crawl",
  "meta": {
    "queriesRun": 16,
    "uniquePmids": 45
  }
}
```

### Log Levels

| Level | Description |
|-------|-------------|
| `error` | Errors requiring attention |
| `warn` | Non-fatal warnings |
| `info` | Normal operation events |
| `debug` | Detailed debugging info |

Set via `LOG_LEVEL` environment variable.

### Viewing Logs

```bash
# Follow today's logs (live)
tail -f logs/daemon-$(date +%Y-%m-%d).log

# Follow error logs
tail -f logs/daemon-error-*.log

# Search for errors
grep -i "error" logs/daemon-*.log

# Search for specific crawler
grep -i "pubmed" logs/daemon-*.log
grep -i "vendor" logs/daemon-*.log

# Parse JSON logs with jq
tail -n 50 logs/daemon-*.log | jq '.'

# Filter by level
tail -n 100 logs/daemon-*.log | jq 'select(.level == "error")'

# Get just messages
tail -n 50 logs/daemon-*.log | jq -r '.message'
```

### Railway Logs

```bash
# Live logs
railway logs --tail

# Last 100 lines
railway logs -n 100

# Follow specific service
railway logs --service openonco-daemon --tail
```

---

## Troubleshooting

### Common Issues

#### 1. Daemon Not Starting

**Symptoms:** Process exits immediately, no logs

**Diagnostics:**
```bash
# Verify Node.js version (requires 20+)
node --version

# Check for syntax errors
node --check src/index.js

# Run with debug logging
LOG_LEVEL=debug npm start
```

**Common causes:**
- Node.js version too old
- Missing dependencies (`npm install`)
- Syntax error in code
- Missing `.env` file

#### 2. Email Not Sending

**Symptoms:** No digest emails received

**Diagnostics:**
```bash
# Verify Resend API key is set
echo $RESEND_API_KEY

# Check logs for email errors
grep -i "email\|resend\|digest" logs/daemon-*.log
```

**Common causes:**
- Missing `RESEND_API_KEY`
- Invalid sender domain (must be verified in Resend)
- Invalid recipient email
- Resend API quota exceeded

#### 3. Crawler Failures

**Symptoms:** Missing discoveries, errors in logs, health shows errors

**Diagnostics:**
```bash
# Check for specific crawler errors
grep -i "error\|failed" logs/daemon-*.log | grep -i "pubmed\|cms\|fda\|vendor"

# Check health status
cat data/health.json | jq '.crawlers'
```

**Common causes:**
- Rate limiting by external API (check error message)
- Network connectivity issues
- API endpoint changed
- API key expired (PubMed)

#### 4. Vendor Crawler Issues

**Symptoms:** Vendor pages not crawling, Playwright errors

**Diagnostics:**
```bash
# Verify Playwright is installed
npx playwright install chromium

# Check for browser errors
grep -i "playwright\|browser\|chromium\|timeout" logs/daemon-*.log
```

**Common causes:**
- Playwright browsers not installed
- Memory constraints (Playwright needs ~200MB)
- Vendor website blocking bot traffic
- Page load timeout (increase timeout or check network)

#### 5. High Memory Usage

**Symptoms:** Process killed, OOM errors

**Diagnostics:**
```bash
# Monitor memory
ps aux | grep node
```

**Solutions:**
- Disable vendor crawler (most memory-intensive): `CRAWLER_VENDOR_ENABLED=false`
- Reduce log verbosity: `LOG_LEVEL=warn`
- Increase instance resources (Railway)

#### 6. Queue Growing Too Large

**Symptoms:** `discoveries.json` very large (>10MB), slow performance

**Diagnostics:**
```bash
# Count discoveries
cat data/discoveries.json | jq length

# Check for old items
cat data/discoveries.json | jq '[.[] | select(.discoveredAt < "2026-01-01")] | length'

# Check file size
ls -lh data/discoveries.json
```

**Solutions:**
- Cleanup runs automatically at midnight
- Manual cleanup:
  ```javascript
  import { cleanupOldDiscoveries } from './src/queue/index.js';
  await cleanupOldDiscoveries(30); // Remove items > 30 days old
  ```

---

## Manual Operations

### Trigger Crawlers Manually

#### Using run-now.js

```bash
# Run all crawlers immediately
node run-now.js
```

This runs each crawler sequentially and shows results.

#### Using Scheduler API

```javascript
import { triggerCrawler, runAllCrawlersNow, triggerDigest } from './src/scheduler.js';

// Run specific crawler
await triggerCrawler('pubmed');
await triggerCrawler('cms');
await triggerCrawler('fda');
await triggerCrawler('vendor');
await triggerCrawler('preprints');

// Run all crawlers
const results = await runAllCrawlersNow();

// Send digest immediately
await triggerDigest();
```

### Send Digest Manually

```bash
# Quick script
cat << 'EOF' > send-digest.js
import 'dotenv/config';
import { sendDailyDigest } from './src/email/index.js';

sendDailyDigest()
  .then(result => {
    console.log('Digest sent:', result);
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
EOF

node send-digest.js
```

### Clear Queue

```bash
# Backup first
cp data/discoveries.json data/discoveries.backup.json

# Clear all discoveries (careful!)
echo "[]" > data/discoveries.json
```

### Reset Vendor Hashes

Forces re-crawl of all vendor pages (first crawl captures baseline, subsequent runs detect changes):

```bash
rm data/vendor-hashes.json
```

### Manual Cleanup

```javascript
import { cleanupOldDiscoveries } from './src/queue/index.js';

// Remove discoveries older than 30 days (default)
const result = await cleanupOldDiscoveries();
console.log(`Removed ${result.removed} old discoveries`);

// Remove discoveries older than 7 days
const result7 = await cleanupOldDiscoveries(7);
```

---

## Backup and Recovery

### Files to Backup

| File | Importance | Loss Impact |
|------|------------|-------------|
| `data/discoveries.json` | High | Loss of pending reviews |
| `data/health.json` | Medium | Loss of health history |
| `data/vendor-hashes.json` | Low | Re-crawls all vendor pages |
| `.env` | Critical | Must recreate manually |

### Backup Script

```bash
#!/bin/bash
BACKUP_DIR="/backups/daemon/$(date +%Y%m%d-%H%M)"
mkdir -p "$BACKUP_DIR"

cp data/discoveries.json "$BACKUP_DIR/"
cp data/health.json "$BACKUP_DIR/"
cp data/vendor-hashes.json "$BACKUP_DIR/"
cp .env "$BACKUP_DIR/"

echo "Backup completed: $BACKUP_DIR"
```

### Recovery

```bash
# Stop daemon
railway down  # or launchctl unload for Mac

# Restore data files
cp /backups/daemon/20260116-1400/discoveries.json data/
cp /backups/daemon/20260116-1400/health.json data/

# Restart
railway up  # or launchctl load for Mac
```

---

## Monitoring Checklist

### Daily

- [ ] Digest email received
- [ ] No critical errors in logs
- [ ] Pending count reasonable (<500)

### Weekly

- [ ] All crawlers ran successfully (check health.json)
- [ ] Log file sizes reasonable
- [ ] Memory usage stable

### Monthly

- [ ] Review error trends
- [ ] Update monitored tests/vendors if needed
- [ ] Check for API deprecation notices
- [ ] Verify backup process

---

## Performance Tuning

### Memory Optimization

For memory-constrained environments:

```bash
# Disable vendor crawler (uses Playwright)
CRAWLER_VENDOR_ENABLED=false

# Reduce log verbosity
LOG_LEVEL=warn
```

### Network Optimization

If experiencing rate limiting:

```bash
# Reduce rate limits
RATE_LIMIT_PUBMED=5
RATE_LIMIT_CMS=3
RATE_LIMIT_FDA=3
```

### Spread Crawler Load

Prevent simultaneous crawls:

```bash
SCHEDULE_PUBMED=0 5 * * *     # 5:00 AM
SCHEDULE_CMS=0 6 * * 0        # 6:00 AM Sunday
SCHEDULE_FDA=0 7 * * 1        # 7:00 AM Monday
SCHEDULE_VENDOR=0 8 * * 2     # 8:00 AM Tuesday
SCHEDULE_PREPRINTS=0 9 * * 3  # 9:00 AM Wednesday
```

---

## Scaling Considerations

The daemon is designed for single-instance operation. For high-availability:

1. **External Database**: Replace JSON files with PostgreSQL/MongoDB
2. **Message Queue**: Replace file-based queue with Redis/RabbitMQ
3. **Distributed Locking**: Prevent duplicate crawler runs across instances

These require code modifications beyond the current architecture.
