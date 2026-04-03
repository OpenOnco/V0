#!/usr/bin/env node
/**
 * Fetch a paper from PubMed by PMID and save as markdown.
 *
 * Usage:
 *   node evidence/scripts/fetch-paper.js 35657320
 *
 * Saves:
 *   evidence/raw/papers/{pmid}.md   — markdown with frontmatter
 *   evidence/meta/sources.json      — updated registry
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../..");
const PAPERS_DIR = resolve(PROJECT_ROOT, "evidence/raw/papers");
const SOURCES_PATH = resolve(PROJECT_ROOT, "evidence/meta/sources.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// ---------------------------------------------------------------------------
// XML extraction helpers (regex-based, no dependency)
// ---------------------------------------------------------------------------

/** Return inner text of the first <tag>…</tag> match (non-greedy). */
function xmlTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? stripTags(m[1]).trim() : null;
}

/** Return ALL matches of <tag>…</tag>. */
function xmlTagAll(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const results = [];
  let m;
  while ((m = re.exec(xml)) !== null) results.push(m[1]);
  return results;
}

/** Return the full outer element for all <tag …>…</tag> blocks. */
function xmlElementAll(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, "gi");
  return xml.match(re) || [];
}

/** Get an attribute value from an element string. */
function xmlAttr(element, attr) {
  const re = new RegExp(`${attr}\\s*=\\s*"([^"]*)"`, "i");
  const m = element.match(re);
  return m ? m[1] : null;
}

/** Strip all XML/HTML tags. */
function stripTags(s) {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// PubMed metadata
// ---------------------------------------------------------------------------

async function fetchPubmedMeta(pmid) {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&rettype=xml`;
  const xml = await fetchText(url);

  // Check for errors / missing article
  if (xml.includes("<ERROR>") || !xml.includes("<PubmedArticle>")) {
    throw new Error(`PubMed returned no article for PMID ${pmid}`);
  }

  const title = xmlTag(xml, "ArticleTitle") || "Unknown title";

  // Abstract — may have multiple AbstractText sections (structured abstract)
  const abstractParts = xmlTagAll(xml, "AbstractText");
  const abstractXmlElements = xmlElementAll(xml, "AbstractText");
  let abstractText = "";
  if (abstractParts.length > 1) {
    // Structured abstract: extract Label attributes
    abstractText = abstractXmlElements
      .map((el) => {
        const label = xmlAttr(el, "Label");
        const text = stripTags(el);
        return label ? `**${label}**: ${text}` : text;
      })
      .join("\n\n");
  } else if (abstractParts.length === 1) {
    abstractText = stripTags(abstractParts[0]);
  } else {
    abstractText = "Abstract not available.";
  }

  // Authors
  const authorElements = xmlElementAll(xml, "Author");
  const authors = authorElements.map((el) => {
    const last = xmlTag(el, "LastName") || "";
    const initials = xmlTag(el, "Initials") || "";
    return `${last} ${initials}`.trim();
  });
  let authorsStr = "";
  let authorsShort = "";
  if (authors.length === 0) {
    authorsStr = "Unknown authors";
    authorsShort = "Unknown";
  } else if (authors.length <= 3) {
    authorsStr = authors.join(", ");
    authorsShort = authors.length === 1 ? `${authors[0]}` : `${authors[0]} et al.`;
  } else {
    authorsStr = `${authors.slice(0, 3).join(", ")}, et al.`;
    authorsShort = `${authors[0].split(" ")[0]} et al.`;
  }

  // Journal
  const journal = xmlTag(xml, "ISOAbbreviation") || xmlTag(xml, "Title") || "Unknown journal";

  // Year
  const pubDateBlock = xmlElementAll(xml, "PubDate")[0] || "";
  const year = parseInt(xmlTag(pubDateBlock, "Year") || "0", 10) || null;

  // DOI
  const articleIdElements = xmlElementAll(xml, "ArticleId");
  let doi = null;
  for (const el of articleIdElements) {
    if (xmlAttr(el, "IdType") === "doi") {
      doi = stripTags(el);
      break;
    }
  }

  return { title, abstractText, authorsStr, authorsShort, journal, year, doi };
}

// ---------------------------------------------------------------------------
// PMCID lookup
// ---------------------------------------------------------------------------

async function fetchPmcid(pmid) {
  const url = `https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?ids=${pmid}&format=json`;
  try {
    const text = await fetchText(url);
    const data = JSON.parse(text);
    const record = data?.records?.[0];
    return record?.pmcid || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// PMC full text
// ---------------------------------------------------------------------------

async function fetchPmcFullText(pmcid) {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=${pmcid}&rettype=xml`;
  try {
    const xml = await fetchText(url);
    if (xml.includes("<ERROR>") || !xml.includes("<body>")) {
      return null;
    }
    return parsePmcBody(xml);
  } catch {
    return null;
  }
}

function parsePmcBody(xml) {
  // Extract the <body> element
  const bodyMatch = xml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return null;
  const body = bodyMatch[1];

  // Extract sections: look for <sec> blocks with <title>
  const sections = xmlElementAll(body, "sec");
  if (sections.length === 0) {
    // No sections — just return stripped body text
    const text = stripTags(body).trim();
    return text || null;
  }

  const parts = [];
  for (const sec of sections) {
    const secTitle = xmlTag(sec, "title");
    // Get the text content, stripping nested <sec> elements to avoid duplication
    // Only take the direct paragraph content
    const paragraphs = xmlTagAll(sec, "p");
    const text = paragraphs.map((p) => stripTags(p).trim()).filter(Boolean).join("\n\n");
    if (secTitle && text) {
      parts.push(`### ${secTitle}\n\n${text}`);
    } else if (text) {
      parts.push(text);
    }
  }

  return parts.join("\n\n") || null;
}

// ---------------------------------------------------------------------------
// Markdown generation
// ---------------------------------------------------------------------------

function buildMarkdown({ pmid, pmcid, title, authorsStr, journal, year, doi, abstractText, fullText }) {
  const frontmatter = [
    "---",
    `pmid: "${pmid}"`,
    pmcid ? `pmcid: "${pmcid}"` : `pmcid: null`,
    `title: "${title.replace(/"/g, '\\"')}"`,
    `authors: "${authorsStr.replace(/"/g, '\\"')}"`,
    `journal: "${journal.replace(/"/g, '\\"')}"`,
    `year: ${year || "null"}`,
    `doi: "${doi || ""}"`,
    `fetched: "${today()}"`,
    "---",
  ].join("\n");

  let body = `# ${title}\n\n## Abstract\n\n${abstractText}`;
  if (fullText) {
    body += `\n\n## Full Text\n\n${fullText}`;
  }

  return `${frontmatter}\n\n${body}\n`;
}

// ---------------------------------------------------------------------------
// Sources registry
// ---------------------------------------------------------------------------

function updateSources({ pmid, pmcid, title, authorsShort, journal, year, doi }) {
  let sources = {};
  if (existsSync(SOURCES_PATH)) {
    try {
      sources = JSON.parse(readFileSync(SOURCES_PATH, "utf-8"));
    } catch {
      sources = {};
    }
  }

  sources[pmid] = {
    title,
    authors_short: authorsShort,
    journal,
    year,
    doi: doi || null,
    pmcid: pmcid || null,
    raw_file: `raw/papers/${pmid}.md`,
    fetched_date: today(),
  };

  mkdirSync(dirname(SOURCES_PATH), { recursive: true });
  writeFileSync(SOURCES_PATH, JSON.stringify(sources, null, 2) + "\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const pmid = process.argv[2];
  if (!pmid || !/^\d+$/.test(pmid)) {
    console.error("Usage: node evidence/scripts/fetch-paper.js <PMID>");
    console.error("  e.g. node evidence/scripts/fetch-paper.js 35657320");
    process.exit(1);
  }

  console.log(`Fetching PubMed metadata for PMID ${pmid}...`);
  let meta;
  try {
    meta = await fetchPubmedMeta(pmid);
  } catch (err) {
    console.error(`Error fetching PubMed metadata: ${err.message}`);
    process.exit(1);
  }

  await sleep(350);

  console.log(`Looking up PMCID...`);
  const pmcid = await fetchPmcid(pmid);
  if (pmcid) {
    console.log(`Found ${pmcid}, fetching full text from PMC...`);
  } else {
    console.log(`No PMC version available.`);
  }

  let fullText = null;
  if (pmcid) {
    await sleep(350);
    fullText = await fetchPmcFullText(pmcid);
    if (fullText) {
      console.log(`Full text retrieved.`);
    } else {
      console.log(`Could not extract full text from PMC.`);
    }
  }

  // Build and save markdown
  const md = buildMarkdown({
    pmid,
    pmcid,
    title: meta.title,
    authorsStr: meta.authorsStr,
    journal: meta.journal,
    year: meta.year,
    doi: meta.doi,
    abstractText: meta.abstractText,
    fullText,
  });

  mkdirSync(PAPERS_DIR, { recursive: true });
  const outPath = resolve(PAPERS_DIR, `${pmid}.md`);
  writeFileSync(outPath, md);
  console.log(`Saved ${outPath}`);

  // Update sources registry
  updateSources({
    pmid,
    pmcid,
    title: meta.title,
    authorsShort: meta.authorsShort,
    journal: meta.journal,
    year: meta.year,
    doi: meta.doi,
  });
  console.log(`Updated ${SOURCES_PATH}`);

  console.log(`\nDone: "${meta.title}" (${meta.journal}, ${meta.year})`);
}

main();
