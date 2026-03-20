import { useState, useCallback } from 'react';

const INITIAL_STATE = {
  age: '',
  sex: '',
  personalCancerDiagnosis: false,
  personalCancerType: '',
  continueAfterDiagnosis: false,
  familyHistory: [],
  smokingStatus: 'never',
  screenings: [],
};

export function useIntakeForm() {
  const [form, setForm] = useState(INITIAL_STATE);
  const [step, setStep] = useState(0);

  const TOTAL_STEPS = 6;

  const update = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const next = useCallback(() => {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, []);

  const back = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const reset = useCallback(() => {
    setForm(INITIAL_STATE);
    setStep(0);
  }, []);

  return { form, step, TOTAL_STEPS, update, next, back, reset };
}
