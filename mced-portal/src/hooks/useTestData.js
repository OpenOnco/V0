import { useState, useEffect } from 'react';
import { fetchMcedTests } from '../utils/api';
import { TESTS as FALLBACK_TESTS } from '../data/tests';

export function useTestData() {
  const [tests, setTests] = useState(FALLBACK_TESTS);
  const [source, setSource] = useState('local'); // 'local' | 'api'

  useEffect(() => {
    let cancelled = false;
    fetchMcedTests()
      .then((data) => {
        if (!cancelled && data.length > 0) {
          setTests(data);
          setSource('api');
        }
      })
      .catch(() => {
        // Silently fall back to hardcoded data
      });
    return () => { cancelled = true; };
  }, []);

  return { tests, source };
}
