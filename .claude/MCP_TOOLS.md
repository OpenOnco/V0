# MCP Tool Reference

Tools available via Claude Desktop for OpenOnco work.

---

## OpenOnco MCP

Direct database access for test information.

### Search Tests

```javascript
// Search MRD tests
openonco_search_mrd({
  vendor: "Natera",
  min_sensitivity: 90,
  approach: "Tumor-informed",
  cancer_type: "Colorectal",
  fields: "id,name,vendor,sensitivity,lod"
})

// Search ECD tests  
openonco_search_ecd({
  test_scope: "Multi-cancer",
  min_specificity: 99
})

// Search TDS tests
openonco_search_tds({
  has_fda_cdx: true,
  min_genes: 300,
  sample_category: "Tissue"
})

// Search HCT tests
openonco_search_hct({
  cancer_type: "Breast",
  min_genes: 30
})
```

### Get Single Test

```javascript
openonco_get_mrd({ id: "mrd-7" })  // By ID
openonco_get_mrd({ name: "Signatera" })  // By name
```

### Compare Tests

```javascript
openonco_compare_mrd({
  names: "Signatera,Guardant Reveal,RaDaR",
  metrics: "name,vendor,sensitivity,specificity,lod,initialTat"
})
```

### Counts & Lists

```javascript
// Count with grouping
openonco_count_mrd({ group_by: "vendor" })
openonco_count_tds({ group_by: "productType" })

// List vendors/cancer types
openonco_list_vendors({ category: "mrd" })
openonco_list_cancer_types({ category: "ecd" })
openonco_list_categories()
```

---

## PubMed

Citation validation and research paper lookup.

### Search

```javascript
PubMed:search_articles({
  query: "Signatera colorectal MRD ctDNA",
  max_results: 20,
  date_from: "2023/01/01"
})
```

### Get Details

```javascript
PubMed:get_article_metadata({
  pmids: ["35486828", "34577062"]
})
```

### Full Text (PMC only)

```javascript
// First convert PMID to PMCID
PubMed:convert_article_ids({
  ids: ["35486828"],
  id_type: "pmid"
})

// Then get full text
PubMed:get_full_text_article({
  pmc_ids: ["PMC9046468"]
})
```

### Find Related

```javascript
PubMed:find_related_articles({
  pmids: ["35486828"],
  link_type: "pubmed_pubmed"  // Similar articles
})
```

### Citation Lookup

```javascript
PubMed:lookup_article_by_citation({
  citations: [{
    journal: "Nature Medicine",
    year: 2023,
    first_page: "1234",
    author: "Smith"
  }]
})
```

---

## CMS MCP

Medicare coverage policy lookup.

### Search LCDs (Local)

```javascript
CMS MCP:search_local_coverage({
  keyword: "molecular residual disease",
  document_type: "lcd",
  limit: 10
})
```

### Search NCDs (National)

```javascript
CMS MCP:search_national_coverage({
  keyword: "next generation sequencing",
  document_type: "ncd"
})
```

### Get Document Details

```javascript
CMS MCP:get_coverage_document({
  document_type: "ncd",
  document_id: 90  // For NCD 90.2
})
```

### Recent Changes

```javascript
CMS MCP:get_whats_new_report({
  scope: "national",
  timeframe: 30,  // Days
  document_type: ["NCD", "NCA"]
})
```

### Key Policy Numbers
- **L38779** - MRD testing
- **NCD 90.2** - NGS/CGP
- **NCD 210.3** - CRC screening
- **L38043** - Liquid CGP

---

## Gmail

Process vendor submissions and correspondence.

### Search

```javascript
Gmail:search_gmail_messages({
  q: "from:natera.com subject:OpenOnco"
})
```

### Read Thread

```javascript
Gmail:read_gmail_thread({
  thread_id: "18e1234abc",
  include_full_messages: true
})
```

### Get Profile

```javascript
Gmail:read_gmail_profile()
```

---

## Figma

Design implementation.

### Get Design Context

```javascript
Figma:get_design_context({
  fileKey: "abc123",
  nodeId: "1:2"
})
```

### Get Screenshot

```javascript
Figma:get_screenshot({
  fileKey: "abc123",
  nodeId: "1:2"
})
```

---

## PostHog

User analytics (Project ID: 281704).

### Query Data

```javascript
posthog:query-run({
  query: {
    kind: "InsightVizNode",
    source: {
      kind: "TrendsQuery",
      series: [{
        kind: "EventsNode",
        event: "$pageview",
        math: "total"
      }]
    }
  }
})
```

### Get Events

```javascript
posthog:event-definitions-list({
  limit: 50
})
```

---

## Desktop Commander

File operations and terminal commands.

### Read/Write Files

```javascript
desktop-commander:read_file({
  path: "/Users/adickinson/Documents/GitHub/V0/src/data.js",
  offset: 0,
  length: 100  // First 100 lines
})

desktop-commander:write_file({
  path: "/path/to/file",
  content: "...",
  mode: "rewrite"  // or "append"
})
```

### Search Files

```javascript
desktop-commander:start_search({
  path: "/Users/adickinson/Documents/GitHub/V0/src",
  pattern: "Signatera",
  searchType: "content"
})
```

### Run Commands

```javascript
desktop-commander:start_process({
  command: "npm run build",
  timeout_ms: 60000
})
```

---

## Claude Code

Agentic coding assistant.

```javascript
claude-code:claude_code({
  prompt: "Add a new MRD test called 'TestName' from vendor 'VendorName' with sensitivity 95% and specificity 99%",
  workFolder: "/Users/adickinson/Documents/GitHub/V0"
})
```

Good for:
- Complex multi-file edits
- Git operations
- Code refactoring
- When you need a second opinion on implementation
