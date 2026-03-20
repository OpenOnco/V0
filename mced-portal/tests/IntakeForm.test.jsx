import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import IntakeForm from '../src/components/IntakeForm';

const defaultForm = {
  age: '',
  sex: '',
  personalCancerDiagnosis: false,
  continueAfterDiagnosis: false,
  personalCancerType: '',
  familyHistory: [],
  smokingStatus: 'never',
  screenings: [],
};

function renderForm(overrides = {}) {
  const props = {
    form: { ...defaultForm, ...overrides },
    step: 0,
    totalSteps: 6,
    onUpdate: vi.fn(),
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  return { ...render(<IntakeForm {...props} />), props };
}

describe('IntakeForm', () => {
  it('renders age step first', () => {
    renderForm();
    expect(screen.getByText('What is your age?')).toBeInTheDocument();
  });

  it('shows physician gating intro on first step', () => {
    renderForm();
    expect(screen.getByText(/helps you prepare for a conversation with your doctor/)).toBeInTheDocument();
    expect(screen.getByText(/All MCED tests require a physician/)).toBeInTheDocument();
  });

  it('disables Next when no age selected', () => {
    renderForm();
    const nextBtn = screen.getByText('Next');
    expect(nextBtn).toBeDisabled();
  });

  it('enables Next when age is selected', () => {
    renderForm({ form: { ...defaultForm, age: '50-54' } });
    const nextBtn = screen.getByText('Next');
    expect(nextBtn).not.toBeDisabled();
  });

  it('shows progress bar', () => {
    renderForm();
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument();
  });

  it('disables Back on first step', () => {
    renderForm();
    const backBtn = screen.getByText('Back');
    expect(backBtn).toBeDisabled();
  });

  it('renders sex step at step 1', () => {
    renderForm({ step: 1 });
    expect(screen.getByText('Sex assigned at birth')).toBeInTheDocument();
  });

  it('renders cancer history step at step 2', () => {
    renderForm({ step: 2 });
    expect(screen.getByText('Cancer diagnosis')).toBeInTheDocument();
  });

  it('renders family history step at step 3', () => {
    renderForm({ step: 3 });
    expect(screen.getByText('Family history')).toBeInTheDocument();
  });

  it('renders smoking step at step 4', () => {
    renderForm({ step: 4 });
    expect(screen.getByText('Smoking status')).toBeInTheDocument();
  });

  it('renders screening step at step 5', () => {
    renderForm({ step: 5, form: { ...defaultForm, sex: 'female' } });
    expect(screen.getByText('Current screenings')).toBeInTheDocument();
  });

  it('shows Build Discussion Guide on last step', () => {
    renderForm({ step: 5, form: { ...defaultForm, sex: 'male' } });
    expect(screen.getByText('Build Discussion Guide')).toBeInTheDocument();
  });

  it('calls onSubmit on last step button click', () => {
    const { props } = renderForm({ step: 5, form: { ...defaultForm, sex: 'male' } });
    fireEvent.click(screen.getByText('Build Discussion Guide'));
    expect(props.onSubmit).toHaveBeenCalled();
  });

  it('does not use prohibited language', () => {
    renderForm();
    const html = document.body.innerHTML.toLowerCase();
    expect(html).not.toContain('your results');
    expect(html).not.toContain('"recommended"');
  });
});
