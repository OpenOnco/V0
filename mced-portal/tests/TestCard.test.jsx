import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TestCard from '../src/components/TestCard';

const THRESHOLDS = { strong: 50, moderate: 25 };

const TEST_WITH_DATA = {
  name: 'Galleri',
  vendor: 'GRAIL',
  cancers: { Lung: 80, Breast: 30, Liver: 10 },
  stageLabel: 'Stage I-II',
};

const TEST_NO_DATA = {
  name: 'Shield MCD',
  vendor: 'Guardant Health',
  cancers: {},
  stageLabel: 'Stage I-II',
};

const TEST_ALL_STAGE = {
  name: 'Galleri',
  vendor: 'GRAIL',
  cancers: { Lung: 90, Breast: 50, Liver: 75 },
  stageLabel: 'Stage I-IV',
};

describe('TestCard', () => {
  it('renders test name and vendor', () => {
    render(<TestCard test={TEST_WITH_DATA} selectedCancers={[]} thresholds={THRESHOLDS} />);
    expect(screen.getByText('Galleri')).toBeInTheDocument();
    expect(screen.getByText('GRAIL')).toBeInTheDocument();
  });

  it('renders OpenOnco badge as anchor with correct href', () => {
    render(<TestCard test={TEST_WITH_DATA} selectedCancers={[]} thresholds={THRESHOLDS} />);
    const badge = screen.getByText('OpenOnco ↗');
    expect(badge.tagName).toBe('A');
    expect(badge).toHaveAttribute('href', 'https://openonco.org/screen/galleri');
    expect(badge).toHaveAttribute('rel', 'noopener noreferrer');
    expect(badge).toHaveAttribute('target', '_blank');
  });

  it('does not show traffic lights when no cancers selected', () => {
    render(<TestCard test={TEST_WITH_DATA} selectedCancers={[]} thresholds={THRESHOLDS} />);
    expect(screen.queryByText('Your selected cancers')).not.toBeInTheDocument();
  });

  it('shows traffic lights with correct colors for selected cancers', () => {
    render(
      <TestCard test={TEST_WITH_DATA} selectedCancers={['Lung', 'Breast', 'Liver']} thresholds={THRESHOLDS} />
    );
    expect(screen.getByText('Your selected cancers')).toBeInTheDocument();
    expect(screen.getByText('Lung')).toBeInTheDocument();
    expect(screen.getByText('80.0%')).toBeInTheDocument();
    expect(screen.getByText('Breast')).toBeInTheDocument();
    expect(screen.getByText('30.0%')).toBeInTheDocument();
    expect(screen.getByText('Liver')).toBeInTheDocument();
    expect(screen.getByText('10.0%')).toBeInTheDocument();
  });

  it('shows green dot for sensitivity above strong threshold', () => {
    const { container } = render(
      <TestCard test={TEST_WITH_DATA} selectedCancers={['Lung']} thresholds={THRESHOLDS} />
    );
    const dots = container.querySelectorAll('.rounded-full');
    const greenDot = [...dots].find((d) => d.style.backgroundColor === 'rgb(74, 186, 74)');
    expect(greenDot).toBeTruthy();
  });

  it('shows amber dot for sensitivity between moderate and strong', () => {
    const { container } = render(
      <TestCard test={TEST_WITH_DATA} selectedCancers={['Breast']} thresholds={THRESHOLDS} />
    );
    const dots = container.querySelectorAll('.rounded-full');
    const amberDot = [...dots].find((d) => d.style.backgroundColor === 'rgb(239, 159, 39)');
    expect(amberDot).toBeTruthy();
  });

  it('shows red dot for sensitivity at or below moderate threshold', () => {
    const { container } = render(
      <TestCard test={TEST_WITH_DATA} selectedCancers={['Liver']} thresholds={THRESHOLDS} />
    );
    const dots = container.querySelectorAll('.rounded-full');
    const redDot = [...dots].find((d) => d.style.backgroundColor === 'rgb(226, 75, 74)');
    expect(redDot).toBeTruthy();
  });

  it('shows -- for cancer with no data', () => {
    render(
      <TestCard test={TEST_WITH_DATA} selectedCancers={['Pancreas']} thresholds={THRESHOLDS} />
    );
    expect(screen.getByText('--')).toBeInTheDocument();
  });

  it('shows Stage I-II label when stageLabel is early', () => {
    render(
      <TestCard test={TEST_WITH_DATA} selectedCancers={['Lung']} thresholds={THRESHOLDS} />
    );
    expect(screen.getByText('Stage I-II')).toBeInTheDocument();
  });

  it('shows Stage I-IV label when stageLabel is all-stage', () => {
    render(
      <TestCard test={TEST_ALL_STAGE} selectedCancers={['Lung']} thresholds={THRESHOLDS} />
    );
    expect(screen.getByText('Stage I-IV')).toBeInTheDocument();
  });

  it('shows no-data stamp for empty test', () => {
    render(<TestCard test={TEST_NO_DATA} selectedCancers={[]} thresholds={THRESHOLDS} />);
    expect(screen.getByText(/No early stage per cancer data published/i)).toBeInTheDocument();
  });

  it('shows additional cancer count when selections are made', () => {
    render(
      <TestCard test={TEST_WITH_DATA} selectedCancers={['Lung']} thresholds={THRESHOLDS} />
    );
    // 3 cancers total, 1 selected → 2 additional
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/additional/)).toBeInTheDocument();
  });

  it('shows default count label when no selections', () => {
    render(<TestCard test={TEST_WITH_DATA} selectedCancers={[]} thresholds={THRESHOLDS} />);
    // 3 cancers, no selections → shows 3
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('recolors dots when thresholds change', () => {
    // With threshold 90, Lung (80) should be amber, not green
    const highThresholds = { strong: 90, moderate: 50 };
    const { container } = render(
      <TestCard test={TEST_WITH_DATA} selectedCancers={['Lung']} thresholds={highThresholds} />
    );
    const dots = container.querySelectorAll('.rounded-full');
    const amberDot = [...dots].find((d) => d.style.backgroundColor === 'rgb(239, 159, 39)');
    expect(amberDot).toBeTruthy();
  });
});
