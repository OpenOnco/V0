/**
 * React Hooks for Glossary DAL Access
 *
 * These hooks provide synchronous access to glossary data
 * by pre-loading data at module level.
 *
 * @module dal/hooks/useGlossary
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { dal } from '../../data.js';

// ============================================================================
// Module-level caching for sync access
// ============================================================================

let _cachedGlossary = null;
let _loadPromise = null;

/**
 * Ensure glossary data is loaded (with caching)
 * @returns {Promise<Array>} All glossary terms
 */
async function ensureLoaded() {
  if (_cachedGlossary) return _cachedGlossary;
  if (!_loadPromise) {
    _loadPromise = dal.glossary.findAll().then(({ data }) => {
      _cachedGlossary = data;
      return data;
    });
  }
  return _loadPromise;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook: Get all glossary terms from the DAL
 *
 * @returns {{ terms: Array, loading: boolean, error: Error|null }}
 *
 * @example
 * const { terms, loading } = useGlossary();
 */
export function useGlossary() {
  const [terms, setTerms] = useState(_cachedGlossary || []);
  const [loading, setLoading] = useState(!_cachedGlossary);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (_cachedGlossary) {
      setTerms(_cachedGlossary);
      setLoading(false);
      return;
    }

    ensureLoaded()
      .then(data => {
        setTerms(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, []);

  return { terms, loading, error };
}

/**
 * Hook: Get a glossary term by ID
 *
 * @param {string} id - Term ID (e.g., 'ctdna', 'mrd')
 * @returns {{ term: Object|null, loading: boolean, error: Error|null }}
 *
 * @example
 * const { term } = useGlossaryTerm('ctdna');
 */
export function useGlossaryTerm(id) {
  const { terms, loading, error } = useGlossary();

  const term = useMemo(() => {
    if (!id || !terms.length) return null;
    return terms.find(t => t.id === id) || null;
  }, [terms, id]);

  return { term, loading, error };
}

/**
 * Hook: Find a glossary term by term name
 *
 * @param {string} termName - Term name (e.g., 'Liquid Biopsy')
 * @returns {{ term: Object|null, loading: boolean, error: Error|null }}
 *
 * @example
 * const { term } = useGlossaryByName('Liquid Biopsy');
 */
export function useGlossaryByName(termName) {
  const { terms, loading, error } = useGlossary();

  const term = useMemo(() => {
    if (!termName || !terms.length) return null;
    const nameLower = termName.toLowerCase();
    return terms.find(t => t.term?.toLowerCase() === nameLower) || null;
  }, [terms, termName]);

  return { term, loading, error };
}

/**
 * Hook: Search glossary terms
 *
 * @param {string} query - Search query
 * @returns {{ results: Array, loading: boolean, error: Error|null }}
 *
 * @example
 * const { results } = useGlossarySearch('dna');
 */
export function useGlossarySearch(query) {
  const { terms, loading, error } = useGlossary();

  const results = useMemo(() => {
    if (!query || !terms.length) return [];

    const queryLower = query.toLowerCase();

    const matches = terms.filter(entry => {
      return (
        entry.term?.toLowerCase().includes(queryLower) ||
        entry.definition?.toLowerCase().includes(queryLower) ||
        entry.shortDefinition?.toLowerCase().includes(queryLower) ||
        entry.id?.toLowerCase().includes(queryLower)
      );
    });

    // Sort by relevance (term match > definition match)
    matches.sort((a, b) => {
      const aTermMatch = a.term?.toLowerCase().includes(queryLower) ? 1 : 0;
      const bTermMatch = b.term?.toLowerCase().includes(queryLower) ? 1 : 0;
      return bTermMatch - aTermMatch;
    });

    return matches;
  }, [terms, query]);

  return { results, loading, error };
}

/**
 * Hook: Get related terms for a glossary entry
 *
 * @param {string} termId - Term ID
 * @returns {{ relatedTerms: Array, loading: boolean, error: Error|null }}
 *
 * @example
 * const { relatedTerms } = useRelatedTerms('ctdna');
 */
export function useRelatedTerms(termId) {
  const { terms, loading, error } = useGlossary();

  const relatedTerms = useMemo(() => {
    if (!termId || !terms.length) return [];

    const entry = terms.find(t => t.id === termId);
    if (!entry?.relatedTerms?.length) return [];

    return entry.relatedTerms
      .map(relatedId => terms.find(t => t.id === relatedId))
      .filter(Boolean);
  }, [terms, termId]);

  return { relatedTerms, loading, error };
}

/**
 * Hook: Get glossary terms by source
 *
 * @param {string} source - Source name (e.g., 'NCI', 'FDA')
 * @returns {{ terms: Array, loading: boolean, error: Error|null }}
 *
 * @example
 * const { terms } = useGlossaryBySource('NCI');
 */
export function useGlossaryBySource(source) {
  const { terms, loading, error } = useGlossary();

  const filtered = useMemo(() => {
    if (!source || !terms.length) return [];
    return terms.filter(t => t.source === source);
  }, [terms, source]);

  return { terms: filtered, loading, error };
}

/**
 * Hook: Get a random glossary term
 * Re-randomizes on each call or when deps change
 *
 * @param {Array} [deps=[]] - Dependencies to trigger re-random
 * @returns {{ term: Object|null, refresh: Function, loading: boolean, error: Error|null }}
 *
 * @example
 * const { term, refresh } = useRandomTerm();
 */
export function useRandomTerm(deps = []) {
  const { terms, loading, error } = useGlossary();
  const [randomIndex, setRandomIndex] = useState(0);

  const refresh = useCallback(() => {
    if (terms.length > 0) {
      setRandomIndex(Math.floor(Math.random() * terms.length));
    }
  }, [terms.length]);

  useEffect(() => {
    refresh();
  }, [refresh, ...deps]);

  const term = useMemo(() => {
    if (!terms.length) return null;
    return terms[randomIndex] || terms[0];
  }, [terms, randomIndex]);

  return { term, refresh, loading, error };
}

/**
 * Hook: Get a glossary lookup function
 * Returns a memoized function for quick term lookups
 *
 * @returns {{ lookup: Function, loading: boolean, error: Error|null }}
 *
 * @example
 * const { lookup } = useGlossaryLookup();
 * const definition = lookup('ctdna')?.shortDefinition;
 */
export function useGlossaryLookup() {
  const { terms, loading, error } = useGlossary();

  const lookupMap = useMemo(() => {
    const map = new Map();
    for (const term of terms) {
      map.set(term.id, term);
      map.set(term.term?.toLowerCase(), term);
    }
    return map;
  }, [terms]);

  const lookup = useCallback(
    (key) => {
      if (!key) return null;
      return lookupMap.get(key) || lookupMap.get(key.toLowerCase()) || null;
    },
    [lookupMap]
  );

  return { lookup, loading, error };
}

/**
 * Reset the cache (for testing)
 */
export function resetGlossaryCache() {
  _cachedGlossary = null;
  _loadPromise = null;
}
