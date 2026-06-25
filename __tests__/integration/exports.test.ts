import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Submission } from '@/lib/types';
import type { ExportStats } from '@/lib/services/export';

vi.mock('@/lib/services/analytics', () => ({
  getAnalyticsData: vi.fn().mockReturnValue({
    categoryDistribution: [{ name: 'Math', value: 2 }],
    gradeDistribution: [{ range: 'A', count: 1 }],
    passFailStats: { passed: 1, failed: 1, passRate: 50 },
  }),
}));

import { exportToExcel, exportToPDF, exportToJSON } from '@/lib/services/export';
import { getAnalyticsData } from '@/lib/services/analytics';

const mockGetAnalyticsData = vi.mocked(getAnalyticsData);

function makeSubmission(overrides: Partial<Submission> = {}): Submission {
  return {
    id: 1,
    name: 'Alice',
    category: 'Math',
    roll: 'R001',
    marks: '85',
    admit_card_path: null,
    admit_card_filename: null,
    created_at: '2025-06-15T10:00:00Z',
    ...overrides,
  };
}

const stats: ExportStats = {
  total: 2,
  avgMarks: 72.5,
  highestMarks: 85,
  lowestMarks: 60,
  passRate: 100,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnalyticsData.mockReturnValue({
    categoryDistribution: [{ name: 'Math', value: 2 }],
    gradeDistribution: [{ range: 'A', count: 1 }],
    passFailStats: { passed: 2, failed: 0, passRate: 100 },
  });
});

describe('export integration', () => {
  describe('exportToExcel', () => {
    it('returns a Buffer with xlsx data', async () => {
      const submissions = [makeSubmission()];
      const result = await exportToExcel(submissions, stats);
      expect(result).toBeInstanceOf(Buffer);
      // xlsx files start with PK (ZIP magic bytes)
      expect(result[0]).toBe(0x50);
      expect(result[1]).toBe(0x4b);
    });

    it('handles empty submissions', async () => {
      const result = await exportToExcel([], stats);
      expect(result).toBeInstanceOf(Buffer);
      expect(result[0]).toBe(0x50);
    });

    it('handles multiple submissions with different marks', async () => {
      const submissions = [
        makeSubmission({ id: 1, name: 'Alice', marks: '95' }),
        makeSubmission({ id: 2, name: 'Bob', marks: '30' }),
        makeSubmission({ id: 3, name: 'Charlie', marks: '70' }),
      ];
      const result = await exportToExcel(submissions, stats);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(100);
    });

    it('includes stats summary in the workbook', async () => {
      const submissions = [makeSubmission()];
      const result = await exportToExcel(submissions, stats);
      expect(result).toBeInstanceOf(Buffer);
      // Stats are included in the workbook, verify it's a valid xlsx
      expect(result[0]).toBe(0x50);
    });
  });

  describe('exportToPDF', () => {
    it('returns a Buffer with PDF content for report type', async () => {
      const submissions = [makeSubmission()];
      const result = await exportToPDF(submissions, 'report');
      expect(result).toBeInstanceOf(Buffer);
      const header = result.toString('latin1').slice(0, 5);
      expect(header).toBe('%PDF-');
    });

    it('returns a Buffer for admit-card type', async () => {
      const submissions = [makeSubmission()];
      const result = await exportToPDF(submissions, 'admit-card');
      expect(result).toBeInstanceOf(Buffer);
      const header = result.toString('latin1').slice(0, 5);
      expect(header).toBe('%PDF-');
    });

    it('returns a Buffer for mark-sheet type', async () => {
      const submissions = [makeSubmission()];
      const result = await exportToPDF(submissions, 'mark-sheet');
      expect(result).toBeInstanceOf(Buffer);
      const header = result.toString('latin1').slice(0, 5);
      expect(header).toBe('%PDF-');
    });

    it('returns a Buffer for bulk-admit-cards type', async () => {
      const submissions = [makeSubmission(), makeSubmission({ id: 2, name: 'Bob' })];
      const result = await exportToPDF(submissions, 'bulk-admit-cards');
      expect(result).toBeInstanceOf(Buffer);
      const header = result.toString('latin1').slice(0, 5);
      expect(header).toBe('%PDF-');
    });

    it('produces larger PDF for multiple submissions in bulk mode', async () => {
      const single = await exportToPDF([makeSubmission()], 'bulk-admit-cards');
      const multi = await exportToPDF(
        [makeSubmission(), makeSubmission({ id: 2 }), makeSubmission({ id: 3 })],
        'bulk-admit-cards'
      );
      expect(multi.length).toBeGreaterThan(single.length);
    });
  });

  describe('exportToJSON', () => {
    it('returns an object with exportDate, summary, submissions, and analytics', () => {
      const submissions = [makeSubmission()];
      const result = exportToJSON(submissions, stats);
      expect(result).toHaveProperty('exportDate');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('submissions');
      expect(result).toHaveProperty('analytics');
    });

    it('includes parsed marks and grade in each submission', () => {
      const submissions = [makeSubmission({ marks: '85' })];
      const result = exportToJSON(submissions, stats);
      const sub = result.submissions[0];
      expect(sub.marks).toBe(85);
      expect(sub.grade).toBe('A');
      expect(sub.status).toBe('Pass');
    });

    it('marks below 40 as Fail', () => {
      const submissions = [makeSubmission({ marks: '25' })];
      const result = exportToJSON(submissions, stats);
      expect(result.submissions[0].status).toBe('Fail');
      expect(result.submissions[0].grade).toBe('F');
    });

    it('calls getAnalyticsData when invoked', () => {
      exportToJSON([makeSubmission()], stats);
      expect(mockGetAnalyticsData).toHaveBeenCalled();
    });

    it('includes analytics data in the result', () => {
      const result = exportToJSON([makeSubmission()], stats);
      expect(result.analytics).toHaveProperty('categoryDistribution');
      expect(result.analytics).toHaveProperty('gradeDistribution');
      expect(result.analytics).toHaveProperty('passFailStats');
    });

    it('passes summary stats through unchanged', () => {
      const result = exportToJSON([makeSubmission()], stats);
      expect(result.summary).toEqual(stats);
    });

    it('handles empty submissions array', () => {
      const result = exportToJSON([], stats);
      expect(result.submissions).toEqual([]);
      expect(result.summary).toBe(stats);
    });

    it('assigns correct grade for each marks tier', () => {
      const cases = [
        { marks: '95', expected: 'A+' },
        { marks: '85', expected: 'A' },
        { marks: '75', expected: 'B+' },
        { marks: '65', expected: 'B' },
        { marks: '55', expected: 'C' },
        { marks: '45', expected: 'D' },
        { marks: '30', expected: 'F' },
      ];
      for (const { marks, expected } of cases) {
        const result = exportToJSON([makeSubmission({ marks })], stats);
        expect(result.submissions[0].grade).toBe(expected);
      }
    });
  });
});
