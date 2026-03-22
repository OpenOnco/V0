import { useState, useEffect } from 'react';
import { fetchMcedTests } from '../utils/api';

export function useTestData() {
  const [tests, setTests] = useState([]);
  const [source, setSource] = useState('loading'); // 'loading' | 'api' | 'error'

  useEffect(() => {
    let cancelled = false;
    fetchMcedTests()
      .then((data) => {
        if (!cancelled && data.length > 0) {
          setTests(data);
          setSource('api');
        } else if (!cancelled) {
          setSource('error');
        }
      })
      .catch(() => {
        if (!cancelled) setSource('error');
      });
    return () => { cancelled = true; };
  }, []);

  return { tests, source, error: source === 'error' };
}
