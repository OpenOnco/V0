# Data Access Layer (DAL)

**All data access MUST go through the DAL. Do NOT import directly from `data.js`.**

## Quick Start

### React Components → Use Hooks

```javascript
import { useAllTests, useTestsByCategory, useVendors, useChangelog } from '../dal';

// In your component:
const { tests } = useAllTests();
const { vendors } = useVendors();
const { changelog } = useChangelog();
```

### Non-React Code → Use Repository Methods

```javascript
import { dal } from '../data';

// Async repository methods:
const { data: tests } = await dal.tests.findAll();
const test = await dal.tests.findById('mrd-1');
const { data: vendors } = await dal.vendors.findWithAssistanceProgram();
```

## Available Hooks

| Hook | Returns | Use Case |
|------|---------|----------|
| `useAllTests()` | `{ tests, loading }` | All tests across categories |
| `useTestsByCategory(cat)` | `{ tests }` | Tests for one category |
| `useTestVerification(testId)` | `{ isVerified, verification }` | Check if test is vendor-verified |
| `useTestContribution(testId)` | `{ contribution }` | Get vendor contribution data |
| `useVendors()` | `{ vendors }` | All vendor data |
| `useAssistanceProgram(vendor)` | `{ program }` | Patient assistance program |
| `useChangelog()` | `{ changelog }` | Database changelog entries |
| `useGlossaryTerm(key)` | `{ term }` | Single glossary term |
| `useInsuranceProviders()` | `{ providers }` | Insurance provider list |

## Repository Methods

### `dal.tests`
- `findAll(options)` - All tests with filtering/pagination
- `findById(id)` - Single test by ID
- `findByCategory(category)` - Tests by category
- `search(query)` - Full-text search

### `dal.vendors`
- `findAll()` - All vendors
- `findWithAssistanceProgram()` - Vendors with patient assistance
- `getAssistanceProgram(vendorName)` - Get program details
- `isTestVerified(testId)` - Check verification status

### `dal.changelog`
- `findAll()` - All changelog entries
- `getRecentChanges(limit)` - Latest N changes

### `dal.glossary`
- `findByTerm(key)` - Get term definition
- `search(query)` - Search terms

## Architecture

```
data.js (source)
    ↓
normalizers (transform)
    ↓
InMemoryAdapter (storage)
    ↓
Repositories (query methods)
    ↓
Hooks (React integration)
    ↓
Components
```

## Do NOT

```javascript
// WRONG - direct data import
import { VENDOR_VERIFIED, COMPANY_CONTRIBUTIONS } from '../data';
const isVerified = VENDOR_VERIFIED[testId];

// CORRECT - use DAL
import { useTestVerification } from '../dal';
const { isVerified } = useTestVerification(testId);
```

The DAL exists to abstract data access for future database migration.
