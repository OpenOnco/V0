import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { query, healthCheck, hasPgVector, close } from '../../../src/db/mrd-client.js';

describe('MRD Database Client', () => {
  beforeAll(async () => {
    // Ensure MRD_DATABASE_URL is set for tests
    if (!process.env.MRD_DATABASE_URL) {
      throw new Error('MRD_DATABASE_URL required for database tests');
    }
  });

  afterAll(async () => {
    await close();
  });

  it('connects successfully', async () => {
    const health = await healthCheck();
    expect(health.connected).toBe(true);
    expect(health.timestamp).toBeDefined();
  });

  it('has pgvector extension', async () => {
    const hasVector = await hasPgVector();
    expect(hasVector).toBe(true);
  });

  it('can query mrd_guidance_items table', async () => {
    const result = await query('SELECT COUNT(*) as count FROM mrd_guidance_items');
    expect(result.rows[0].count).toBeDefined();
  });

  it('can query mrd_clinical_trials table', async () => {
    const result = await query('SELECT COUNT(*) as count FROM mrd_clinical_trials');
    expect(result.rows[0].count).toBeDefined();
  });

  it('can query mrd_discovery_queue table', async () => {
    const result = await query('SELECT COUNT(*) as count FROM mrd_discovery_queue');
    expect(result.rows[0].count).toBeDefined();
  });

  it('can query mrd_crawler_runs table', async () => {
    const result = await query('SELECT COUNT(*) as count FROM mrd_crawler_runs');
    expect(result.rows[0].count).toBeDefined();
  });

  it('can query mrd_item_embeddings table', async () => {
    const result = await query('SELECT COUNT(*) as count FROM mrd_item_embeddings');
    expect(result.rows[0].count).toBeDefined();
  });

  it('can query mrd_trial_publications table', async () => {
    const result = await query('SELECT COUNT(*) as count FROM mrd_trial_publications');
    expect(result.rows[0].count).toBeDefined();
  });
});
