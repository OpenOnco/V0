import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../src/App';

describe('App', () => {
  it('renders all 5 test cards on load', () => {
    render(<App />);
    expect(screen.getByText('Caris Detect')).toBeInTheDocument();
    expect(screen.getByText('Galleri')).toBeInTheDocument();
    expect(screen.getByText('Cancerguard')).toBeInTheDocument();
    expect(screen.getByText('EPISEEK')).toBeInTheDocument();
    expect(screen.getByText('Shield MCD')).toBeInTheDocument();
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

  it('shows no-data stamp on Shield MCD', () => {
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

  it('shows legend', () => {
    render(<App />);
    expect(screen.getByText('Strong detection')).toBeInTheDocument();
    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText('Limited or not tested')).toBeInTheDocument();
  });

  it('shows methodology section', () => {
    render(<App />);
    expect(screen.getByText('Methodology')).toBeInTheDocument();
    expect(screen.getAllByText(/Stage I-II/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/physician/i)).toBeInTheDocument();
  });

  it('shows Price TBD for Caris Detect', () => {
    render(<App />);
    expect(screen.getByText('Price TBD')).toBeInTheDocument();
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
