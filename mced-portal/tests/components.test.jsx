import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FamilyDropdown from '../src/components/FamilyDropdown';
import SmokingToggle from '../src/components/SmokingToggle';
import ScreeningGaps from '../src/components/ScreeningGaps';
import GeneticFactors from '../src/components/GeneticFactors';

describe('FamilyDropdown', () => {
  const cancers = ['Lung', 'Breast', 'Liver'];

  it('renders label and dropdown', () => {
    render(
      <FamilyDropdown label="Mother's side" side="mom" cancers={cancers} entries={[]} onAdd={() => {}} onRemove={() => {}} />
    );
    expect(screen.getByText("Mother's side")).toBeInTheDocument();
    expect(screen.getByText('Select cancer type...')).toBeInTheDocument();
  });

  it('calls onAdd when cancer selected', () => {
    const onAdd = vi.fn();
    render(
      <FamilyDropdown label="Mother's side" side="mom" cancers={cancers} entries={[]} onAdd={onAdd} onRemove={() => {}} />
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Lung' } });
    expect(onAdd).toHaveBeenCalledWith('Lung', 'mom');
  });

  it('renders tags for entries and calls onRemove', () => {
    const entries = [
      { cancer: 'Lung', side: 'mom' },
      { cancer: 'Breast', side: 'dad' }, // different side, should not show
    ];
    const onRemove = vi.fn();
    render(
      <FamilyDropdown label="Mother's side" side="mom" cancers={cancers} entries={entries} onAdd={() => {}} onRemove={onRemove} />
    );
    // Only mom's entry should be visible as a tag button
    const lungTags = screen.getAllByText('Lung');
    const lungButton = lungTags.find((el) => el.closest('button.bg-purple-100'));
    expect(lungButton).toBeTruthy();
    fireEvent.click(lungButton.closest('button'));
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it('does not show tags section when no entries for this side', () => {
    const entries = [{ cancer: 'Breast', side: 'dad' }];
    render(
      <FamilyDropdown label="Mother's side" side="mom" cancers={cancers} entries={entries} onAdd={() => {}} onRemove={() => {}} />
    );
    // Breast is dad's side, should not appear as a tag button under mom
    const breastElements = screen.queryAllByText('Breast');
    const breastTag = breastElements.find((el) => el.closest('button.bg-purple-100'));
    expect(breastTag).toBeUndefined();
  });
});

describe('SmokingToggle', () => {
  it('renders inactive state', () => {
    render(<SmokingToggle on={false} onToggle={() => {}} />);
    expect(screen.getByText('Smoker / former smoker')).toBeInTheDocument();
    // No cancer tags when off
    expect(screen.queryByText('Lung')).not.toBeInTheDocument();
  });

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(<SmokingToggle on={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByText('Smoker / former smoker'));
    expect(onToggle).toHaveBeenCalled();
  });

  it('shows smoking cancer tags when active', () => {
    render(<SmokingToggle on={true} onToggle={() => {}} />);
    expect(screen.getByText('Lung')).toBeInTheDocument();
    expect(screen.getByText('Bladder')).toBeInTheDocument();
    expect(screen.getByText('Pancreas')).toBeInTheDocument();
  });
});

describe('ScreeningGaps', () => {
  it('renders female gaps', () => {
    render(<ScreeningGaps sex="female" gapSet={new Set()} onToggle={() => {}} />);
    expect(screen.getByText('No colonoscopy')).toBeInTheDocument();
    expect(screen.getByText('No mammogram')).toBeInTheDocument();
    expect(screen.getByText('No pap/HPV test')).toBeInTheDocument();
    expect(screen.queryByText('No PSA test')).not.toBeInTheDocument();
  });

  it('renders male gaps', () => {
    render(<ScreeningGaps sex="male" gapSet={new Set()} onToggle={() => {}} />);
    expect(screen.getByText('No colonoscopy')).toBeInTheDocument();
    expect(screen.getByText('No PSA test')).toBeInTheDocument();
    expect(screen.queryByText('No mammogram')).not.toBeInTheDocument();
  });

  it('calls onToggle with cancer type', () => {
    const onToggle = vi.fn();
    render(<ScreeningGaps sex="female" gapSet={new Set()} onToggle={onToggle} />);
    fireEvent.click(screen.getByText('No mammogram'));
    expect(onToggle).toHaveBeenCalledWith('Breast');
  });

  it('shows cancer tags when gap is active', () => {
    render(<ScreeningGaps sex="female" gapSet={new Set(['Breast'])} onToggle={() => {}} />);
    // Breast should appear as a tag below the buttons
    const breastElements = screen.getAllByText('Breast');
    expect(breastElements.length).toBeGreaterThanOrEqual(1);
  });
});

describe('GeneticFactors', () => {
  it('renders genetic factor buttons', () => {
    render(<GeneticFactors activeFactors={new Set()} onToggle={() => {}} sex="female" />);
    expect(screen.getByText('BRCA1 or BRCA2')).toBeInTheDocument();
    expect(screen.getByText('MUTYH')).toBeInTheDocument();
    expect(screen.getByText('Lynch syndrome')).toBeInTheDocument();
  });

  it('calls onToggle when factor clicked', () => {
    const onToggle = vi.fn();
    render(<GeneticFactors activeFactors={new Set()} onToggle={onToggle} sex="female" />);
    fireEvent.click(screen.getByText('BRCA1 or BRCA2'));
    expect(onToggle).toHaveBeenCalledWith('brca');
  });

  it('shows cancer tags when BRCA factor is active (female)', () => {
    render(<GeneticFactors activeFactors={new Set(['brca'])} onToggle={() => {}} sex="female" />);
    expect(screen.getByText('Breast')).toBeInTheDocument();
    expect(screen.getByText('Ovary')).toBeInTheDocument();
    expect(screen.getByText('Pancreas')).toBeInTheDocument();
    // Prostate excluded for female
    expect(screen.queryByText('Prostate')).not.toBeInTheDocument();
  });

  it('shows Breast for male BRCA (males can get breast cancer)', () => {
    render(<GeneticFactors activeFactors={new Set(['brca'])} onToggle={() => {}} sex="male" />);
    expect(screen.getByText('Breast')).toBeInTheDocument();
    expect(screen.getByText('Prostate')).toBeInTheDocument();
    // Ovary excluded for male
    expect(screen.queryByText('Ovary')).not.toBeInTheDocument();
  });

  it('shows Lynch syndrome cancers', () => {
    render(<GeneticFactors activeFactors={new Set(['lynch'])} onToggle={() => {}} sex="female" />);
    expect(screen.getByText('Colon/Rectum')).toBeInTheDocument();
    expect(screen.getByText('Endometrial')).toBeInTheDocument();
    expect(screen.getByText('Uterus')).toBeInTheDocument();
    expect(screen.getByText('Ovary')).toBeInTheDocument();
    expect(screen.getByText('Gastric')).toBeInTheDocument();
    expect(screen.getByText('Pancreas')).toBeInTheDocument();
  });

  it('shows MUTYH cancers', () => {
    render(<GeneticFactors activeFactors={new Set(['mutyh'])} onToggle={() => {}} sex="female" />);
    expect(screen.getByText('Colon/Rectum')).toBeInTheDocument();
    expect(screen.getByText('Gastric')).toBeInTheDocument();
    expect(screen.getByText('Endometrial')).toBeInTheDocument();
    expect(screen.getByText('Uterus')).toBeInTheDocument();
    expect(screen.getByText('Ovary')).toBeInTheDocument();
    expect(screen.getByText('Bladder')).toBeInTheDocument();
    expect(screen.getByText('Liver')).toBeInTheDocument();
    expect(screen.getByText('Thyroid')).toBeInTheDocument();
  });
});
