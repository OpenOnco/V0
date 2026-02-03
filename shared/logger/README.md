# @openonco/logger

Shared Pino-based logging module for OpenOnco. Provides consistent structured JSON logging across all projects with environment-aware defaults.

## Installation

This is a local shared package. Add the dependencies to your project's `package.json`:

```json
{
  "dependencies": {
    "pino": "^8.21.0",
    "pino-pretty": "^10.3.1"
  }
}
```

Then import using relative paths:

```javascript
// From api/chat.js
import { createLogger } from '../shared/logger/index.js';

// From physician-system/src/crawlers/fda.js
import { createLogger } from '../../shared/logger/index.js';

// From src/components/Chat.jsx (via Vite)
import { createLogger } from '../shared/logger/index.js';
```

## Quick Start

```javascript
import { createLogger } from '../shared/logger/index.js';

// Create a logger for your module
const logger = createLogger('crawler:fda', { project: 'physician-system' });

// Log at different levels
logger.trace('Detailed trace info', { data });
logger.debug('Debug information', { data });
logger.info('Informational message', { data });
logger.warn('Warning message', { data });
logger.error('Error occurred', { error });
logger.fatal('Fatal error', { error });

// Create child logger with additional context
const requestLogger = logger.child({ requestId: 'abc-123' });
requestLogger.info('Processing request');
```

## API Reference

### createLogger(moduleName, options)

Creates a logger instance with the specified module name.

**Parameters:**
- `moduleName` (string): Component identifier, e.g., `'crawler:fda'`, `'chat:server'`, `'api:v1'`
- `options` (object): Optional configuration
  - `options.project` (string): Project identifier. Auto-detected if not provided.
    - `'frontend'` - React frontend
    - `'api'` - Vercel serverless functions
    - `'physician-system'` - Physician system service
    - `'test-data-tracker'` - Test data tracker service

**Returns:** Logger instance with the following methods:
- `trace(message, data)` - Most detailed level
- `debug(message, data)` - Debug information
- `info(message, data)` - Informational messages
- `warn(message, data)` - Warnings
- `error(message, data)` - Errors
- `fatal(message, data)` - Fatal errors
- `child(bindings)` - Create child logger with additional context

### child(bindings)

Creates a child logger that inherits parent context and adds additional bindings.

```javascript
const logger = createLogger('api:chat');
const requestLogger = logger.child({ requestId: req.headers['x-vercel-id'] });
const userLogger = requestLogger.child({ userId: user.id });

userLogger.info('User action');
// Output includes: module, project, hostname, requestId, userId
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Minimum log level: `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent` | `info` (prod), `debug` (dev), `silent` (test) |
| `LOG_PRETTY` | Force pretty-print output: `true` or `false` | `true` (dev), `false` (prod) |
| `NODE_ENV` | Environment: `development`, `production`, `test` | `development` |
| `OPENONCO_PROJECT` | Override project auto-detection | Auto-detected |

## Log Levels

From most to least verbose:

| Level | Value | Description |
|-------|-------|-------------|
| `trace` | 10 | Most detailed, for tracing execution flow |
| `debug` | 20 | Debug information for development |
| `info` | 30 | Informational messages about normal operation |
| `warn` | 40 | Warning conditions that should be reviewed |
| `error` | 50 | Error conditions that need attention |
| `fatal` | 60 | Fatal errors that cause shutdown |
| `silent` | ∞ | Suppresses all output |

## Environment Behavior

| Environment | Default Level | Pretty Print | Output Format |
|-------------|---------------|--------------|---------------|
| Development | `debug` | Yes | Colorized, human-readable |
| Production | `info` | No | JSON, one line per entry |
| Test | `silent` | - | No output |

Browser environments use `warn` in production to reduce console noise.

## Output Format

### Development (Pretty Print)

```
[2024-01-15 10:30:45.123] INFO (crawler:fda): Starting crawl
    project: "physician-system"
    hostname: "dev-machine"
    url: "https://example.com"
```

### Production (JSON)

```json
{"timestamp":"2024-01-15T10:30:45.123Z","level":"info","module":"crawler:fda","project":"physician-system","hostname":"prod-server","msg":"Starting crawl","url":"https://example.com"}
```

## Error Logging

Errors are automatically serialized with full details:

```javascript
try {
  await fetchData();
} catch (error) {
  logger.error('Failed to fetch data', { error });
}
```

Output includes:
- `error.message`
- `error.name`
- `error.stack`
- `error.code` (if present)
- `error.statusCode` (if present)
- Any additional enumerable properties

## Examples

### Vercel API Function

```javascript
// api/chat.js
import { createLogger } from '../shared/logger/index.js';

const logger = createLogger('api:chat', { project: 'api' });

export default async function handler(req, res) {
  const requestLogger = logger.child({
    requestId: req.headers['x-vercel-id']
  });

  requestLogger.info('Chat request received', {
    persona: req.body.persona
  });

  try {
    const response = await generateResponse(req.body);
    requestLogger.debug('Response generated', { tokens: response.usage });
    res.json(response);
  } catch (error) {
    requestLogger.error('Chat request failed', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### Backend Service Crawler

```javascript
// physician-system/src/crawlers/fda.js
import { createLogger } from '../../shared/logger/index.js';

const logger = createLogger('crawler:fda', { project: 'physician-system' });

export async function crawlFDA() {
  logger.info('Starting FDA crawl');

  for (const url of urls) {
    const pageLogger = logger.child({ url });

    try {
      const data = await fetchPage(url);
      pageLogger.debug('Page fetched', { size: data.length });
    } catch (error) {
      pageLogger.error('Failed to fetch page', { error });
    }
  }

  logger.info('FDA crawl complete');
}
```

### React Component

```javascript
// src/components/Chat.jsx
import { createLogger } from '../shared/logger/index.js';

const logger = createLogger('chat:ui', { project: 'frontend' });

export function Chat() {
  const handleSubmit = async (message) => {
    logger.debug('Sending message', { length: message.length });

    try {
      const response = await sendMessage(message);
      logger.info('Message sent successfully');
    } catch (error) {
      logger.error('Failed to send message', { error });
    }
  };

  // ...
}
```

## Contextual Fields

Every log entry automatically includes:

| Field | Description |
|-------|-------------|
| `timestamp` | ISO 8601 timestamp |
| `level` | Log level name |
| `module` | From `createLogger()` first argument |
| `project` | From options or auto-detected |
| `hostname` | Server hostname or `'browser'` |

Additional context can be added via `child()` or by passing data objects to log methods.

## Best Practices

1. **Use descriptive module names**: `'crawler:fda'`, `'api:chat'`, `'triage:classifier'`

2. **Add context via child loggers**: Create child loggers for requests, users, or operations

3. **Log at appropriate levels**:
   - `trace`: Execution flow, loop iterations
   - `debug`: Variable values, function results
   - `info`: Significant events (start/end of operations)
   - `warn`: Unexpected but recoverable conditions
   - `error`: Failures that need attention
   - `fatal`: Unrecoverable errors

4. **Include relevant data**: Pass structured data, not string concatenation
   ```javascript
   // Good
   logger.info('User logged in', { userId, method: 'oauth' });

   // Bad
   logger.info(`User ${userId} logged in via oauth`);
   ```

5. **Always include errors**: Pass the error object for full stack traces
   ```javascript
   logger.error('Operation failed', { error, context: 'additional info' });
   ```
