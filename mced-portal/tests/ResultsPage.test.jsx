import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ResultsPage from '../src/components/ResultsPage';

const mockForm = {
  age: '50-54',
  sex: 'female',
  personalCancerDiagnosis: false,
  continueAfterDiagnosis: false,
  personalCancerType: '',
  familyHistory: ['Lung', 'Pancreas'],
  smokingStatus: 'never',
  screenings: ['colonoscopy', 'papHpv'],
};

const mockSortedTests = [
  {
    test: {
      id: 'ecd-2',
      name: 'Galleri',
      vendor: 'GRAIL',
      detectedCancerTypes: ['Lung', 'Pancreas', 'Breast'],
      listPrice: 949,
      sensitivity: 51.5,
      specificity: 99.5,
      fdaStatus: 'LDT',
    },
    trafficLight: {
      concernRows: [
        { cancer: 'Lung', tier: 'good', sensitivity: 74.8, sampleSize: 404 },
        { cancer: 'Pancreas', tier: 'good', sensitivity: 83.7, sampleSize: 135 },
      ],
      gapRows: [
        { cancer: 'Breast', tier: 'ok', sensitivity: 30.5, sampleSize: 524 },
      ],
      hasAnySensitivityData: true,
    },
    greenCount: 2,
    amberCount: 1,
    redCount: 0,
    noDataCount: 0,
    hasData: true,
  },
  {
    test: {
      id: 'ecd-10',
      name: 'Shield MCD',
      vendor: 'Guardant Health',
      detectedCancerTypes: ['Lung', 'Pancreas'],
      listPrice: 895,
      fdaStatus: 'LDT',
    },
    trafficLight: {
      concernRows: [],
      gapRows: [],
      hasAnySensitivityData: false,
    },
    greenCount: 0,
    amberCount: 0,
    redCount: 0,
    noDataCount: 0,
    hasData: false,
  },
];

const defaultProps = {
  form: mockForm,
  sortedTests: mockSortedTests,
  concerns: ['Lung', 'Pancreas'],
  gaps: ['Breast'],
  allEqual: false,
  onStartOver: vi.fn(),
};

describe('ResultsPage', () => {
  it('renders as "Discussion Guide" not "Results"', () => {
    render(<ResultsPage {...defaultProps} />);
    expect(screen.getByText('Your Discussion Guide')).toBeInTheDocument();
    expect(screen.getByText(/Bring this to your next appointment/)).toBeInTheDocument();
  });

  it('renders test names in the matrix', () => {
    render(<ResultsPage {...defaultProps} />);
    expect(screen.getByText('Galleri')).toBeInTheDocument();
    expect(screen.getByText('Shield MCD')).toBeInTheDocument();
  });

  it('shows profile summary with "cancer types you selected" framing', () => {
    render(<ResultsPage {...defaultProps} />);
    expect(screen.getByText(/Showing cancer types you selected/)).toBeInTheDocument();
  });

  it('shows sensitivity percentages in matrix cells', () => {
    render(<ResultsPage {...defaultProps} />);
    expect(screen.getByText('74.8%')).toBeInTheDocument();
    expect(screen.getByText('83.7%')).toBeInTheDocument();
    expect(screen.getByText('30.5%')).toBeInTheDocument();
  });

  it('marks screening gap columns', () => {
    render(<ResultsPage {...defaultProps} />);
    expect(screen.getByText('gap')).toBeInTheDocument();
  });

  it('shows no-data message for test without sensitivity data', () => {
    render(<ResultsPage {...defaultProps} />);
    expect(screen.getByText(/Sensitivity data not yet available/)).toBeInTheDocument();
  });

  it('shows legend with "published sensitivity" language', () => {
    render(<ResultsPage {...defaultProps} />);
    expect(screen.getByText('>50% published sensitivity')).toBeInTheDocument();
  });

  it('defaults to alphabetical sort', () => {
    render(<ResultsPage {...defaultProps} />);
    // A-Z button should be active
    const azButton = screen.getByText('A–Z');
    expect(azButton.className).toContain('bg-blue-50');
  });

  it('has sort toggle for detection coverage', () => {
    render(<ResultsPage {...defaultProps} />);
    expect(screen.getByText('Detection coverage')).toBeInTheDocument();
  });

  it('renders doctor questions section', () => {
    render(<ResultsPage {...defaultProps} />);
    expect(screen.getByText('Questions to ask your doctor')).toBeInTheDocument();
    expect(screen.getByText(/do you think MCED testing would be appropriate/)).toBeInTheDocument();
  });

  it('calls onStartOver when clicked', () => {
    const onStartOver = vi.fn();
    render(<ResultsPage {...defaultProps} onStartOver={onStartOver} />);
    fireEvent.click(screen.getByText('Start over'));
    expect(onStartOver).toHaveBeenCalled();
  });

  it('shows equal message when allEqual', () => {
    render(<ResultsPage {...defaultProps} allEqual={true} />);
    expect(
      screen.getByText(/You did not select any specific cancer types/)
    ).toBeInTheDocument();
  });

  it('shows empty state when no results', () => {
    render(<ResultsPage {...defaultProps} sortedTests={[]} allEqual={true} />);
    expect(
      screen.getByText(/No MCED tests with published sensitivity data found/)
    ).toBeInTheDocument();
  });

  it('expands test detail panel on name click', () => {
    render(<ResultsPage {...defaultProps} />);
    fireEvent.click(screen.getByText('Galleri'));
    expect(screen.getByText('View full details on OpenOnco')).toBeInTheDocument();
  });

  it('does not use prohibited language', () => {
    render(<ResultsPage {...defaultProps} />);
    const html = document.body.innerHTML.toLowerCase();
    expect(html).not.toContain('your results');
    expect(html).not.toContain('"recommended"');
    expect(html).not.toContain('your risk profile');
    expect(html).not.toContain('top pick');
  });
});
