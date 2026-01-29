/**
 * Test Dictionary for OpenOnco
 *
 * Provides deterministic test matching based on PLA codes, names, aliases, and keywords.
 * Used by crawlers to identify tests before LLM analysis for higher accuracy.
 */

const TEST_DICTIONARY = [
  // =============================================================================
  // MRD (Molecular Residual Disease) Tests
  // =============================================================================
  {
    id: 'mrd-7',
    name: 'Signatera',
    vendor: 'Natera',
    category: 'mrd',
    aliases: ['Signatera MRD', 'Natera Signatera', 'Natera MRD', 'Signatera ctDNA'],
    plaCodes: ['0179U'],
    keywords: ['signatera', 'natera', 'tumor-informed', 'personalized', 'ctdna', 'mrd']
  },
  {
    id: 'mrd-1',
    name: 'Guardant Reveal',
    vendor: 'Guardant Health',
    category: 'mrd',
    aliases: ['Reveal MRD', 'Guardant Reveal MRD', 'Reveal', 'Guardant MRD'],
    plaCodes: ['0298U'],
    keywords: ['reveal', 'guardant', 'tumor-naive', 'epigenomic', 'ctdna', 'mrd']
  },
  {
    id: 'mrd-8',
    name: 'FoundationOne Tracker',
    vendor: 'Foundation Medicine',
    category: 'mrd',
    aliases: ['F1 Tracker', 'FMI Tracker', 'Foundation Tracker', 'FOne Tracker'],
    plaCodes: [],
    keywords: ['foundationone', 'tracker', 'foundation medicine', 'natera', 'tumor-informed', 'ctdna', 'mrd']
  },
  {
    id: 'mrd-4',
    name: 'clonoSEQ',
    vendor: 'Adaptive Biotechnologies',
    category: 'mrd',
    aliases: ['clonoSEQ Assay', 'Adaptive clonoSEQ', 'clonoseq'],
    plaCodes: ['0016U', '0017U', '0358U'],
    keywords: ['clonoseq', 'adaptive', 'hematologic', 'lymphoid', 'myeloma', 'leukemia', 'lymphoma', 'immunosequencing', 'fda']
  },
  {
    id: 'mrd-5',
    name: 'RaDaR',
    vendor: 'NeoGenomics',
    category: 'mrd',
    aliases: ['NeoGenomics RaDaR', 'RaDaR MRD', 'Radar MRD', 'RaDaR ST'],
    plaCodes: [],
    keywords: ['radar', 'neogenomics', 'tumor-informed', 'personalized', 'ctdna', 'mrd']
  },
  {
    id: 'mrd-10',
    name: 'Tempus xM MRD',
    vendor: 'Tempus',
    category: 'mrd',
    aliases: ['xM MRD', 'Tempus MRD', 'Tempus xM'],
    plaCodes: [],
    keywords: ['tempus', 'xm', 'tumor-informed', 'ctdna', 'mrd']
  },
  {
    id: 'mrd-6',
    name: 'NeXT Personal',
    vendor: 'Personalis',
    category: 'mrd',
    aliases: ['Personalis NeXT Personal', 'NeXT Personal MRD', 'NeXT Personal Dx', 'NeXT Dx'],
    plaCodes: [],
    keywords: ['next personal', 'personalis', 'tumor-informed', 'whole-genome', 'ctdna', 'mrd']
  },
  {
    id: 'mrd-9',
    name: 'Oncodetect',
    vendor: 'Exact Sciences',
    category: 'mrd',
    aliases: ['Exact Sciences Oncodetect', 'Oncodetect MRD', 'OncoDetect MRD'],
    plaCodes: [],
    keywords: ['oncodetect', 'exact sciences', 'tumor-informed', 'ctdna', 'mrd']
  },
  {
    id: 'mrd-3',
    name: 'Invitae PCM',
    vendor: 'Labcorp',
    category: 'mrd',
    aliases: ['Invitae Personalized Cancer Monitoring', 'PCM', 'Labcorp Invitae PCM'],
    plaCodes: [],
    keywords: ['invitae', 'pcm', 'personalized cancer monitoring', 'labcorp', 'tumor-informed', 'ctdna', 'mrd']
  },
  {
    id: 'mrd-2',
    name: 'Caris Assure',
    vendor: 'Caris Life Sciences',
    category: 'mrd',
    aliases: ['Assure MRD', 'Caris MRD', 'Caris Assure MRD'],
    plaCodes: [],
    keywords: ['caris', 'assure', 'tumor-informed', 'ctdna', 'mrd']
  },
  {
    id: 'mrd-11',
    name: 'NavDx',
    vendor: 'Naveris',
    category: 'mrd',
    aliases: ['Naveris NavDx', 'NavDx HPV', 'Nav Dx'],
    plaCodes: [],
    keywords: ['navdx', 'naveris', 'hpv', 'hpv-related', 'ctdna', 'mrd', 'oropharyngeal', 'head and neck']
  },

  // =============================================================================
  // TDS (Treatment Decision Support) / CGP Tests
  // =============================================================================
  {
    id: 'tds-1',
    name: 'FoundationOne CDx',
    vendor: 'Foundation Medicine',
    category: 'tds',
    aliases: ['F1CDx', 'FMI CDx', 'Foundation CDx', 'FoundationOne', 'F1 CDx', 'FOne CDx'],
    plaCodes: ['0037U'],
    keywords: ['foundationone', 'foundation medicine', 'cdx', 'cgp', 'comprehensive genomic profiling', 'fda', 'tissue']
  },
  {
    id: 'tds-2',
    name: 'FoundationOne Liquid CDx',
    vendor: 'Foundation Medicine',
    category: 'tds',
    aliases: ['F1LCDx', 'F1L CDx', 'FOne Liquid', 'Foundation Liquid', 'FoundationOne Liquid', 'FMI Liquid'],
    plaCodes: [],
    keywords: ['foundationone', 'liquid', 'foundation medicine', 'ctdna', 'liquid biopsy', 'cgp', 'fda', 'cdx']
  },
  {
    id: 'tds-3',
    name: 'Guardant360 CDx',
    vendor: 'Guardant Health',
    category: 'tds',
    aliases: ['Guardant360', 'G360 CDx', 'Guardant 360', 'G360'],
    plaCodes: ['0239U'],
    keywords: ['guardant360', 'guardant', 'cgp', 'liquid biopsy', 'ctdna', 'fda', 'cdx']
  },
  {
    id: 'tds-7',
    name: 'Tempus xT CDx',
    vendor: 'Tempus',
    category: 'tds',
    aliases: ['xT CDx', 'Tempus xT', 'Tempus CDx'],
    plaCodes: [],
    keywords: ['tempus', 'xt', 'cdx', 'cgp', 'comprehensive genomic profiling', 'fda', 'tissue']
  },
  {
    id: 'tds-8',
    name: 'Tempus xF',
    vendor: 'Tempus',
    category: 'tds',
    aliases: ['xF', 'Tempus Liquid', 'Tempus xF+', 'xF+'],
    plaCodes: [],
    keywords: ['tempus', 'xf', 'cgp', 'liquid biopsy', 'ctdna']
  },
  {
    id: 'tds-5',
    name: 'MSK-IMPACT',
    vendor: 'Memorial Sloan Kettering',
    category: 'tds',
    aliases: ['MSK IMPACT', 'MSKCC IMPACT', 'IMPACT'],
    plaCodes: [],
    keywords: ['msk', 'impact', 'memorial sloan kettering', 'cgp', 'comprehensive genomic profiling', 'fda', 'tissue']
  },
  {
    id: 'tds-4',
    name: 'Caris MI Profile',
    vendor: 'Caris Life Sciences',
    category: 'tds',
    aliases: ['MI Profile', 'Caris Molecular Intelligence', 'Caris CGP', 'MI Cancer Seek'],
    plaCodes: [],
    keywords: ['caris', 'mi profile', 'molecular intelligence', 'cgp', 'comprehensive genomic profiling', 'tissue']
  },
  {
    id: 'tds-6',
    name: 'OmniSeq INSIGHT',
    vendor: 'Labcorp',
    category: 'tds',
    aliases: ['OmniSeq', 'INSIGHT', 'Labcorp OmniSeq'],
    plaCodes: [],
    keywords: ['omniseq', 'insight', 'labcorp', 'cgp', 'comprehensive genomic profiling', 'tissue']
  },

  // =============================================================================
  // ECD (Early Cancer Detection) Tests
  // =============================================================================
  {
    id: 'ecd-1',
    name: 'Galleri',
    vendor: 'GRAIL',
    category: 'ecd',
    aliases: ['GRAIL Galleri', 'Galleri MCED', 'Galleri Test', 'Multi-Cancer Early Detection'],
    plaCodes: ['0239U'],
    keywords: ['galleri', 'grail', 'mced', 'multi-cancer', 'early detection', 'methylation', 'cfdna']
  },
  {
    id: 'ecd-2',
    name: 'Shield',
    vendor: 'Guardant Health',
    category: 'ecd',
    aliases: ['Guardant Shield', 'Shield CRC', 'Guardant CRC', 'Shield Blood Test'],
    plaCodes: [],
    keywords: ['shield', 'guardant', 'colorectal', 'crc', 'screening', 'blood-based']
  },
  {
    id: 'ecd-3',
    name: 'Cologuard',
    vendor: 'Exact Sciences',
    category: 'ecd',
    aliases: ['Cologuard Plus', 'Exact Sciences Cologuard', 'Cologuard+', 'Cologuard 2.0'],
    plaCodes: [],
    keywords: ['cologuard', 'exact sciences', 'colorectal', 'crc', 'screening', 'stool', 'fda', 'sdna']
  },
  {
    id: 'ecd-4',
    name: 'FirstLook Lung',
    vendor: 'DELFI Diagnostics',
    category: 'ecd',
    aliases: ['DELFI FirstLook', 'FirstLook', 'DELFI Lung'],
    plaCodes: [],
    keywords: ['firstlook', 'delfi', 'lung', 'lung cancer', 'screening', 'fragmentomics', 'cfdna']
  },
  {
    id: 'ecd-5',
    name: 'Freenome CRC',
    vendor: 'Freenome',
    category: 'ecd',
    aliases: ['Freenome', 'Freenome Colorectal', 'Freenome CRC Blood Test'],
    plaCodes: [],
    keywords: ['freenome', 'colorectal', 'crc', 'screening', 'blood-based', 'multiomics']
  }
];

/**
 * Escape special regex characters in a string
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Match tests mentioned in text content using deterministic rules
 * @param {string} text - Text content to search
 * @returns {Array<{test: Object, matchType: string, confidence: number, matchedOn: string}>}
 */
function matchTests(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const normalizedText = text.toLowerCase();
  const matches = new Map(); // Use Map to dedupe by test ID

  for (const test of TEST_DICTIONARY) {
    let bestMatch = null;

    // Priority 1: PLA code match (confidence 0.95)
    for (const code of test.plaCodes) {
      // Match code with various formats: 0037U, 0037u, CPT 0037U, PLA 0037U
      const codePatterns = [
        new RegExp(`\\b${code}\\b`, 'i'),
        new RegExp(`cpt[:\\s]*${code}`, 'i'),
        new RegExp(`pla[:\\s]*${code}`, 'i')
      ];

      for (const pattern of codePatterns) {
        if (pattern.test(text)) {
          bestMatch = {
            test,
            matchType: 'pla_code_match',
            confidence: 0.95,
            matchedOn: code
          };
          break;
        }
      }
      if (bestMatch) break;
    }

    // Priority 2: Exact test name match (confidence 0.90)
    if (!bestMatch) {
      const namePattern = new RegExp(`\\b${escapeRegex(test.name)}\\b`, 'i');
      if (namePattern.test(text)) {
        bestMatch = {
          test,
          matchType: 'name_match',
          confidence: 0.90,
          matchedOn: test.name
        };
      }
    }

    // Priority 3: Alias match (confidence 0.85)
    if (!bestMatch) {
      for (const alias of test.aliases) {
        const aliasPattern = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i');
        if (aliasPattern.test(text)) {
          bestMatch = {
            test,
            matchType: 'alias_match',
            confidence: 0.85,
            matchedOn: alias
          };
          break;
        }
      }
    }

    // Priority 4: Vendor + category keyword match (confidence 0.70)
    if (!bestMatch) {
      const vendorPattern = new RegExp(`\\b${escapeRegex(test.vendor.split('/')[0])}\\b`, 'i');
      const vendorMatch = vendorPattern.test(text);

      if (vendorMatch) {
        // Check for category-relevant terms
        const categoryTerms = {
          mrd: ['mrd', 'minimal residual disease', 'residual disease', 'monitoring', 'recurrence', 'ctdna'],
          tds: ['cgp', 'comprehensive genomic', 'tumor profiling', 'companion diagnostic', 'cdx', 'treatment', 'therapy selection'],
          ecd: ['screening', 'early detection', 'multi-cancer', 'mced']
        };

        const relevantTerms = categoryTerms[test.category] || [];
        for (const term of relevantTerms) {
          if (normalizedText.includes(term)) {
            bestMatch = {
              test,
              matchType: 'vendor_keyword_match',
              confidence: 0.70,
              matchedOn: `${test.vendor} + ${term}`
            };
            break;
          }
        }
      }
    }

    // Store the best match for this test
    if (bestMatch) {
      const existing = matches.get(test.id);
      if (!existing || bestMatch.confidence > existing.confidence) {
        matches.set(test.id, bestMatch);
      }
    }
  }

  // Convert to array and sort by confidence (highest first), then by test name for determinism
  return Array.from(matches.values())
    .sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      return a.test.name.localeCompare(b.test.name);
    });
}

/**
 * Format deterministic matches for inclusion in Claude prompts
 * @param {Array} matches - Array of match objects from matchTests()
 * @returns {string} Formatted string for prompt inclusion
 */
function formatMatchesForPrompt(matches) {
  if (!matches || matches.length === 0) {
    return 'No tests were identified by deterministic matching.';
  }

  const lines = matches.map(m => {
    const confidenceLabel = m.confidence >= 0.9 ? 'HIGH' : m.confidence >= 0.75 ? 'MEDIUM' : 'LOW';
    return `- ${m.test.name} (${m.test.vendor}) [${confidenceLabel} confidence: ${m.matchType}, matched on: "${m.matchedOn}"]`;
  });

  return `The following tests were identified by deterministic code/name matching:\n${lines.join('\n')}`;
}

export {
  TEST_DICTIONARY,
  matchTests,
  formatMatchesForPrompt
};
