import { useState, useEffect } from 'react';
import { fetchMcedTests } from '../utils/api';

export function useTestData() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchMcedTests()
      .then((data) => {
        if (!cancelled) {
          setTests(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { tests, loading, error };
}
