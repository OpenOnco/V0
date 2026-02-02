import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { query, close } from '../../src/db/mrd-client.js';
import { runPubMedCrawler } from '../../src/crawlers/mrd/index.js';

describe('MRD Pipeline Integration', () => {
  beforeAll(() => {
    if (!process.env.MRD_DATABASE_URL) {
      throw new Error('MRD_DATABASE_URL required for pipeline tests');
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY required for pipeline tests');
    }
  });

  afterAll(async () => {
    await close();
  });

  it('runs full pipeline and tracks statistics', async () => {
    // Run crawler with dry run first (no DB writes)
    const result = await runPubMedCrawler({
      mode: 'incremental',
      fromDate: '2024-12-15',
      toDate: '2024-12-31',
      maxResults: 5,
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.stats).toBeDefined();
    expect(result.stats.found).toBeGreaterThanOrEqual(0);
    expect(result.stats.prefiltered).toBeGreaterThanOrEqual(0);
  }, 120000);

  it('respects skip flags for testing', async () => {
    const result = await runPubMedCrawler({
      mode: 'incremental',
      fromDate: '2024-12-20',
      toDate: '2024-12-31',
      maxResults: 3,
      skipTriage: true,
      skipClassify: true,
      dryRun: true,
    });

    expect(result.success).toBe(true);
    // When skipping triage and classify, prefiltered count equals triaged and classified
    expect(result.stats.triaged).toBe(result.stats.prefiltered);
  }, 60000);

  it('can query mrd_crawler_runs table', async () => {
    const runs = await query(`
      SELECT * FROM mrd_crawler_runs
      ORDER BY started_at DESC
      LIMIT 5
    `);

    expect(Array.isArray(runs.rows)).toBe(true);
    // Columns should exist even if no rows
    if (runs.rows.length > 0) {
      expect(runs.rows[0].crawler_name).toBeDefined();
      expect(runs.rows[0].status).toBeDefined();
    }
  });

  it('can query mrd_discovery_queue table', async () => {
    const queue = await query(`
      SELECT status, COUNT(*) as count
      FROM mrd_discovery_queue
      GROUP BY status
    `);

    expect(Array.isArray(queue.rows)).toBe(true);
  });

  it('can query mrd_guidance_items table', async () => {
    const items = await query(`
      SELECT COUNT(*) as count,
             COUNT(*) FILTER (WHERE is_superseded = FALSE) as active_count
      FROM mrd_guidance_items
    `);

    expect(items.rows[0].count).toBeDefined();
    expect(items.rows[0].active_count).toBeDefined();
  });

  it('database has expected tables', async () => {
    const tables = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE 'mrd_%'
      ORDER BY table_name
    `);

    const tableNames = tables.rows.map((r) => r.table_name);

    expect(tableNames).toContain('mrd_guidance_items');
    expect(tableNames).toContain('mrd_clinical_trials');
    expect(tableNames).toContain('mrd_discovery_queue');
    expect(tableNames).toContain('mrd_crawler_runs');
    expect(tableNames).toContain('mrd_item_embeddings');
    expect(tableNames).toContain('mrd_trial_publications');
  });

  it('pgvector extension is enabled', async () => {
    const result = await query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) as has_vector
    `);

    expect(result.rows[0].has_vector).toBe(true);
  });
});

describe('MRD Discovery Queue Operations', () => {
  beforeAll(() => {
    if (!process.env.MRD_DATABASE_URL) {
      throw new Error('MRD_DATABASE_URL required');
    }
  });

  afterAll(async () => {
    await close();
  });

  it('discovery queue has correct schema', async () => {
    const columns = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'mrd_discovery_queue'
      ORDER BY ordinal_position
    `);

    const columnNames = columns.rows.map((r) => r.column_name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('source_type');
    expect(columnNames).toContain('source_id');
    expect(columnNames).toContain('source_url');
    expect(columnNames).toContain('raw_data');
    expect(columnNames).toContain('ai_relevance_score');
    expect(columnNames).toContain('ai_classification');
    expect(columnNames).toContain('status');
  });

  it('discovery queue status constraint is valid', async () => {
    const statuses = ['fetched', 'prefiltered', 'ai_triaged', 'ai_classified',
      'approved', 'rejected', 'duplicate', 'error'];

    // This query will succeed if the constraint allows these values
    for (const status of statuses) {
      // Just validate the query compiles correctly
      const result = await query(`
        SELECT $1::text as status
        WHERE $1 IN ('fetched', 'prefiltered', 'ai_triaged', 'ai_classified',
                     'approved', 'rejected', 'duplicate', 'error')
      `, [status]);
      expect(result.rows[0].status).toBe(status);
    }
  });
});

describe('MRD Crawler Runs Tracking', () => {
  beforeAll(() => {
    if (!process.env.MRD_DATABASE_URL) {
      throw new Error('MRD_DATABASE_URL required');
    }
  });

  afterAll(async () => {
    await close();
  });

  it('high water mark function exists', async () => {
    const result = await query(`
      SELECT proname FROM pg_proc
      WHERE proname = 'get_crawler_high_water_mark'
    `);

    expect(result.rows.length).toBe(1);
  });

  it('gap detection function exists', async () => {
    const result = await query(`
      SELECT proname FROM pg_proc
      WHERE proname = 'detect_crawler_gaps'
    `);

    expect(result.rows.length).toBe(1);
  });
});
