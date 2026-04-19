export const normalizeEditSecret = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

export const getEditSecret = () => normalizeEditSecret(import.meta.env.VITE_EDIT_SECRET || '');

export const matchesEditSecret = (candidate, expected = import.meta.env.VITE_EDIT_SECRET || '') => {
  const normalizedCandidate = normalizeEditSecret(candidate).toLowerCase();
  const normalizedExpected = normalizeEditSecret(expected).toLowerCase();
  return normalizedExpected !== '' && normalizedCandidate === normalizedExpected;
};
