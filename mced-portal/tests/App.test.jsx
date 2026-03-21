import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../src/App';

const MOCK_TESTS = [
  { name: 'Test A', vendor: 'Vendor A', source: 'Study A', cancers: { Lung: 80, Breast: 30, Liver: 60 } },
  { name: 'Test B', vendor: 'Vendor B', source: 'Study B', cancers: { Lung: 40, Breast: 10 } },
  { name: 'Test Empty', vendor: 'Vendor C', source: '', cancers: {} },
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
    expect(screen.getByText('MCED test explorer')).toBeInTheDocument();
    expect(screen.getByText(/Prepare for your doctor visit/)).toBeInTheDocument();
  });

  it('hides controls until gender selected', () => {
    render(<App />);
    expect(screen.queryByText("Family cancer history (mom's side)")).not.toBeInTheDocument();
  });

  it('shows controls after selecting female', () => {
    render(<App />);
    fireEvent.click(screen.getByText('female'));
    expect(screen.getByText("Family cancer history (mom's side)")).toBeInTheDocument();
    expect(screen.getByText("Family cancer history (dad's side)")).toBeInTheDocument();
    expect(screen.getByText('Smoker / former smoker')).toBeInTheDocument();
    expect(screen.getByText('No mammogram')).toBeInTheDocument();
  });

  it('shows male-specific screening gaps', () => {
    render(<App />);
    fireEvent.click(screen.getByText('male'));
    expect(screen.getByText('No PSA test')).toBeInTheDocument();
    expect(screen.queryByText('No mammogram')).not.toBeInTheDocument();
  });

  it('shows smoking tags when toggled', () => {
    render(<App />);
    fireEvent.click(screen.getByText('female'));
    fireEvent.click(screen.getByText('Smoker / former smoker'));
    expect(screen.getAllByText('Lung').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Bladder').length).toBeGreaterThanOrEqual(1);
  });

  it('shows no-data stamp on empty test', () => {
    render(<App />);
    expect(screen.getByText(/No early stage per cancer data published/i)).toBeInTheDocument();
  });

  it('resets everything', () => {
    render(<App />);
    fireEvent.click(screen.getByText('female'));
    expect(screen.getByText('Reset all')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Reset all'));
    expect(screen.queryByText("Family cancer history (mom's side)")).not.toBeInTheDocument();
  });

  it('shows legend with live data indicator', () => {
    render(<App />);
    expect(screen.getByText('Strong detection')).toBeInTheDocument();
    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText('Limited or not tested')).toBeInTheDocument();
    expect(screen.getByText('Live data from openonco.org')).toBeInTheDocument();
  });

  it('shows methodology section', () => {
    render(<App />);
    expect(screen.getByText('Methodology')).toBeInTheDocument();
    expect(screen.getAllByText(/Stage I-II/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/physician/i)).toBeInTheDocument();
  });

  it('does not show prices', () => {
    render(<App />);
    const html = document.body.innerHTML;
    expect(html).not.toContain('Price TBD');
    expect(html).not.toContain('$949');
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
