import { describe, it, expect } from 'vitest';
import clinicalTrials, { fetchTrial } from '../../src/crawlers/mrd/clinicaltrials.js';

const { PRIORITY_TRIALS } = clinicalTrials;

describe('ClinicalTrials.gov API', () => {
  // Note: searchTrials uses complex queries that may fail with API changes
  // Focus on individual trial fetching which is more stable

  it('fetches specific trial by NCT number', async () => {
    const trial = await fetchTrial('NCT04264702'); // CIRCULATE-US
    expect(trial.protocolSection.identificationModule.nctId).toBe('NCT04264702');
    expect(trial.protocolSection.identificationModule.briefTitle).toBeDefined();
  }, 30000);

  it('fetches DYNAMIC trial', async () => {
    const trial = await fetchTrial('NCT04120701'); // DYNAMIC
    expect(trial.protocolSection.identificationModule.nctId).toBe('NCT04120701');
    expect(trial.protocolSection.statusModule).toBeDefined();
  }, 30000);

  it('trial has required protocol sections', async () => {
    const trial = await fetchTrial('NCT04264702');
    const protocol = trial.protocolSection;

    expect(protocol.identificationModule).toBeDefined();
    expect(protocol.statusModule).toBeDefined();
    expect(protocol.conditionsModule).toBeDefined();
    expect(protocol.designModule).toBeDefined();
  }, 30000);

  it('fetched trial has conditions', async () => {
    const trial = await fetchTrial('NCT04264702'); // CIRCULATE-US
    const conditions = trial.protocolSection.conditionsModule?.conditions || [];
    expect(conditions.length).toBeGreaterThan(0);
  }, 30000);

  it('PRIORITY_TRIALS constant contains landmark trials', () => {
    expect(PRIORITY_TRIALS).toContain('NCT04264702'); // CIRCULATE-US
    expect(PRIORITY_TRIALS).toContain('NCT04120701'); // DYNAMIC
    expect(PRIORITY_TRIALS).toContain('NCT05078866'); // BESPOKE CRC
    expect(PRIORITY_TRIALS.length).toBeGreaterThanOrEqual(10);
  });

  it('fetches trial with enrollment information', async () => {
    const trial = await fetchTrial('NCT04264702');
    const design = trial.protocolSection.designModule;

    if (design.enrollmentInfo) {
      expect(design.enrollmentInfo.count).toBeDefined();
    }
  }, 30000);

  it('trial status can be extracted', async () => {
    const trial = await fetchTrial('NCT04264702');
    const status = trial.protocolSection.statusModule;

    expect(status.overallStatus).toBeDefined();
    expect(['NOT_YET_RECRUITING', 'RECRUITING', 'ACTIVE_NOT_RECRUITING',
      'COMPLETED', 'TERMINATED', 'WITHDRAWN', 'SUSPENDED',
      'ENROLLING_BY_INVITATION', 'UNKNOWN']).toContain(status.overallStatus);
  }, 30000);
});
