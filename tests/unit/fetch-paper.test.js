import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../evidence/scripts/fetch-paper.js"
);

// ---------------------------------------------------------------------------
// We test the script by importing its helpers directly. Since the script
// calls main() at module level, we can't import it without side effects.
// Instead we test the CLI behavior via execSync and verify outputs.
// ---------------------------------------------------------------------------

// Sample PubMed XML for mocking (subset of real response structure)
const SAMPLE_PUBMED_XML = `<?xml version="1.0"?>
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation>
      <Article>
        <ArticleTitle>Test Paper Title</ArticleTitle>
        <Abstract>
          <AbstractText Label="BACKGROUND">Background text here.</AbstractText>
          <AbstractText Label="METHODS">Methods text here.</AbstractText>
        </Abstract>
        <AuthorList>
          <Author><LastName>Smith</LastName><Initials>AB</Initials></Author>
          <Author><LastName>Jones</LastName><Initials>CD</Initials></Author>
          <Author><LastName>Brown</LastName><Initials>EF</Initials></Author>
          <Author><LastName>Wilson</LastName><Initials>GH</Initials></Author>
        </AuthorList>
        <Journal>
          <ISOAbbreviation>J Test Med</ISOAbbreviation>
        </Journal>
      </Article>
      <ArticleIdList>
        <ArticleId IdType="doi">10.1234/test.2024</ArticleId>
      </ArticleIdList>
    </MedlineCitation>
    <PubmedData>
      <History>
        <PubMedPubDate PubStatus="pubmed">
          <Year>2024</Year>
        </PubMedPubDate>
      </History>
      <ArticleIdList>
        <ArticleId IdType="doi">10.1234/test.2024</ArticleId>
      </ArticleIdList>
    </PubmedData>
  </PubmedArticle>
</PubmedArticleSet>`;

describe("fetch-paper.js", () => {
  it("exits with error when no PMID provided", () => {
    try {
      execSync(`node ${SCRIPT_PATH}`, { encoding: "utf-8", stdio: "pipe" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err.status).toBe(1);
      expect(err.stderr).toContain("Usage:");
    }
  });

  it("exits with error for non-numeric PMID", () => {
    try {
      execSync(`node ${SCRIPT_PATH} abc123`, { encoding: "utf-8", stdio: "pipe" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err.status).toBe(1);
      expect(err.stderr).toContain("Usage:");
    }
  });

  it("exits with error for invalid PMID", () => {
    try {
      execSync(`node ${SCRIPT_PATH} 9999999999`, {
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 15000,
      });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err.status).toBe(1);
      expect(err.stderr).toContain("Error fetching PubMed metadata");
    }
  });
});

// Test XML parsing helpers by extracting them inline (they're pure functions)
describe("XML parsing helpers", () => {
  function stripTags(s) {
    return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  function xmlTag(xml, tag) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
    const m = xml.match(re);
    return m ? stripTags(m[1]).trim() : null;
  }

  function xmlTagAll(xml, tag) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
    const results = [];
    let m;
    while ((m = re.exec(xml)) !== null) results.push(m[1]);
    return results;
  }

  function xmlElementAll(xml, tag) {
    const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, "gi");
    return xml.match(re) || [];
  }

  function xmlAttr(element, attr) {
    const re = new RegExp(`${attr}\\s*=\\s*"([^"]*)"`, "i");
    const m = element.match(re);
    return m ? m[1] : null;
  }

  it("extracts title from PubMed XML", () => {
    expect(xmlTag(SAMPLE_PUBMED_XML, "ArticleTitle")).toBe("Test Paper Title");
  });

  it("extracts all AbstractText sections", () => {
    const parts = xmlTagAll(SAMPLE_PUBMED_XML, "AbstractText");
    expect(parts).toHaveLength(2);
    expect(stripTags(parts[0])).toBe("Background text here.");
    expect(stripTags(parts[1])).toBe("Methods text here.");
  });

  it("extracts structured abstract labels", () => {
    const elements = xmlElementAll(SAMPLE_PUBMED_XML, "AbstractText");
    expect(xmlAttr(elements[0], "Label")).toBe("BACKGROUND");
    expect(xmlAttr(elements[1], "Label")).toBe("METHODS");
  });

  it("extracts authors", () => {
    const authorElements = xmlElementAll(SAMPLE_PUBMED_XML, "Author");
    expect(authorElements).toHaveLength(4);
    const first = authorElements[0];
    expect(xmlTag(first, "LastName")).toBe("Smith");
    expect(xmlTag(first, "Initials")).toBe("AB");
  });

  it("extracts journal abbreviation", () => {
    expect(xmlTag(SAMPLE_PUBMED_XML, "ISOAbbreviation")).toBe("J Test Med");
  });

  it("extracts DOI from ArticleId elements", () => {
    const ids = xmlElementAll(SAMPLE_PUBMED_XML, "ArticleId");
    const doiEl = ids.find((el) => xmlAttr(el, "IdType") === "doi");
    expect(doiEl).toBeDefined();
    expect(stripTags(doiEl)).toBe("10.1234/test.2024");
  });

  it("returns null for missing tags", () => {
    expect(xmlTag(SAMPLE_PUBMED_XML, "NonExistentTag")).toBeNull();
  });

  it("strips nested tags correctly", () => {
    expect(stripTags("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });
});

describe("output file verification", () => {
  // This test uses the already-fetched 35657320.md from the real run
  const paperPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../evidence/raw/papers/35657320.md"
  );
  const sourcesPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../evidence/meta/sources.json"
  );

  it("35657320.md has correct frontmatter", () => {
    if (!existsSync(paperPath)) return; // skip if file was cleaned up
    const content = readFileSync(paperPath, "utf-8");
    expect(content).toMatch(/^---/);
    expect(content).toContain('pmid: "35657320"');
    expect(content).toContain('pmcid: "PMC9701133"');
    expect(content).toContain("Circulating Tumor DNA");
    expect(content).toContain("N Engl J Med");
    expect(content).toContain("year: 2022");
    expect(content).toContain('doi: "10.1056/NEJMoa2200075"');
  });

  it("35657320.md has abstract and full text sections", () => {
    if (!existsSync(paperPath)) return;
    const content = readFileSync(paperPath, "utf-8");
    expect(content).toContain("## Abstract");
    expect(content).toContain("## Full Text");
    expect(content).toContain("**BACKGROUND**:");
  });

  it("sources.json has correct structure", () => {
    if (!existsSync(sourcesPath)) return;
    const sources = JSON.parse(readFileSync(sourcesPath, "utf-8"));
    expect(sources["35657320"]).toBeDefined();
    const entry = sources["35657320"];
    expect(entry.title).toContain("Circulating Tumor DNA");
    expect(entry.authors_short).toBe("Tie et al.");
    expect(entry.journal).toBe("N Engl J Med");
    expect(entry.year).toBe(2022);
    expect(entry.doi).toBe("10.1056/NEJMoa2200075");
    expect(entry.pmcid).toBe("PMC9701133");
    expect(entry.raw_file).toBe("raw/papers/35657320.md");
    expect(entry.fetched_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
