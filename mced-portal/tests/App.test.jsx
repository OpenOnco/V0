import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../src/App';

const MOCK_TESTS = [
  { name: 'Test A', vendor: 'Vendor A', source: 'Study A', cancers: { Lung: 80, Breast: 30, Liver: 60 }, allStageCancers: { Lung: 90, Breast: 50, Liver: 75 } },
  { name: 'Test B', vendor: 'Vendor B', source: 'Study B', cancers: { Lung: 40, Breast: 10 }, allStageCancers: { Lung: 60, Breast: 30 } },
  { name: 'Test Empty', vendor: 'Vendor C', source: '', cancers: {}, allStageCancers: {} },
];

vi.mock('../src/hooks/useTestData', () => ({
  useTestData: () => ({ tests: MOCK_TESTS, source: 'api' }),
}));

describe('App', () => {
  it('renders test cards', () => {
    render(<App />);
    expect(screen.getByText('Test A')).toBeInTheDocument();
    expect(screen.getByText('Test B')).toBeInTheDocument();
    expect(screen.getByText('Test Empty')).toBeInTheDocument();
  });

  it('shows header text', () => {
    render(<App />);
    expect(screen.getByText(/MCED Per-Cancer Data Filter/)).toBeInTheDocument();
  });

  it('hides controls until gender selected', () => {
    render(<App />);
    expect(screen.queryByText("Family cancer history (mother's side)")).not.toBeInTheDocument();
  });

  it('shows controls after selecting female', () => {
    render(<App />);
    fireEvent.click(screen.getByText('female'));
    expect(screen.getByText("Family cancer history (mother's side)")).toBeInTheDocument();
    expect(screen.getByText("Family cancer history (father's side)")).toBeInTheDocument();
    expect(screen.getByText('Smoker / former smoker')).toBeInTheDocument();
    expect(screen.getByText('No mammogram')).toBeInTheDocument();
  });

  it('shows male-specific screening gaps', () => {
    render(<App />);
    fireEvent.click(screen.getByText('male'));
    expect(screen.getByText('No PSA test')).toBeInTheDocument();
    expect(screen.queryByText('No mammogram')).not.toBeInTheDocument();
  });

  it('shows no-data stamp on empty test', () => {
    render(<App />);
    expect(screen.getByText(/No early stage per cancer data published/i)).toBeInTheDocument();
  });

  it('resets everything', () => {
    render(<App />);
    fireEvent.click(screen.getByText('female'));
    fireEvent.click(screen.getByText('Reset all'));
    expect(screen.queryByText("Family cancer history (mother's side)")).not.toBeInTheDocument();
  });

  it('shows legend with live data indicator', () => {
    render(<App />);
    expect(screen.getByText('Strong detection')).toBeInTheDocument();
    expect(screen.getByText('Live data from openonco.org')).toBeInTheDocument();
  });

  it('has settings link in methodology', () => {
    render(<App />);
    expect(screen.getByText('settings')).toBeInTheDocument();
  });

  it('opens settings popup from methodology link', () => {
    render(<App />);
    fireEvent.click(screen.getByText('settings'));
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Stage I-II (early)')).toBeInTheDocument();
    expect(screen.getByText('All stages')).toBeInTheDocument();
  });

  it('does not use prohibited language', () => {
    render(<App />);
    const html = document.body.innerHTML.toLowerCase();
    expect(html).not.toContain('"recommended"');
    expect(html).not.toContain('your results');
    expect(html).not.toContain('your risk');
    expect(html).not.toContain('best test');
  });
});
