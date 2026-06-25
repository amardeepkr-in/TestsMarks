import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => {
  const mockRun = vi.fn();
  const mockGet = vi.fn();
  const mockAll = vi.fn();
  return {
    default: {
      prepare: vi.fn(() => ({
        run: mockRun,
        get: mockGet,
        all: mockAll,
      })),
    },
  };
});

import db from '@/lib/db';
import {
  saveFilter,
  getFilters,
  getFilterById,
  updateFilter,
  deleteFilter,
  setDefaultFilter,
  getDefaultFilter,
  duplicateFilter,
  applyFilter,
} from '@/lib/services/filters';
import type { AdvancedSearchFilters } from '@/lib/services/search';

const mockPrepare = vi.mocked(db.prepare);
const mockRun = vi.fn();
const mockGet = vi.fn();
const mockAll = vi.fn();

function setupPrepareMock() {
  mockPrepare.mockReturnValue({ run: mockRun, get: mockGet, all: mockAll } as any);
}

const sampleFilterConfig: AdvancedSearchFilters = {
  query: 'test',
  category: ['Math'],
  marksMin: 50,
  marksMax: 100,
};

const sampleRow = {
  id: 1,
  user_id: 1,
  name: 'My Filter',
  config: JSON.stringify(sampleFilterConfig),
  is_default: 0,
  created_at: '2025-06-15T10:00:00Z',
  updated_at: '2025-06-15T10:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  setupPrepareMock();
});

describe('filters integration', () => {
  describe('saveFilter', () => {
    it('inserts a filter and returns the saved result', async () => {
      mockRun.mockReturnValue({ lastInsertRowid: 1, changes: 1 });
      mockGet.mockReturnValue(sampleRow);

      const result = await saveFilter(1, 'My Filter', sampleFilterConfig);

      expect(mockPrepare).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalledWith(1, 'My Filter', JSON.stringify(sampleFilterConfig), 0);
      expect(result.name).toBe('My Filter');
      expect(result.config).toEqual(sampleFilterConfig);
      expect(result.is_default).toBe(false);
    });

    it('sets is_default to 1 when isDefault is true', async () => {
      mockRun.mockReturnValue({ lastInsertRowid: 1, changes: 1 });
      mockGet.mockReturnValue({ ...sampleRow, is_default: 1 });

      await saveFilter(1, 'Default Filter', sampleFilterConfig, true);

      // First call unsets other defaults
      expect(mockRun).toHaveBeenCalledWith(1);
      // Second call inserts with is_default=1
      expect(mockRun).toHaveBeenCalledWith(1, 'Default Filter', JSON.stringify(sampleFilterConfig), 1);
    });

    it('throws when database insert fails', async () => {
      mockRun.mockImplementation(() => { throw new Error('DB error'); });
      await expect(saveFilter(1, 'Fail', sampleFilterConfig)).rejects.toThrow('DB error');
    });

    it('serializes config to JSON on insert', async () => {
      mockRun.mockReturnValue({ lastInsertRowid: 1, changes: 1 });
      mockGet.mockReturnValue(sampleRow);

      await saveFilter(1, 'Test', sampleFilterConfig);

      const insertCall = mockRun.mock.calls.find(
        (call: any[]) => typeof call[2] === 'string' && call[2].includes('{')
      );
      expect(insertCall).toBeDefined();
    });
  });

  describe('getFilters', () => {
    it('returns all filters for a user, parsed from JSON', async () => {
      mockAll.mockReturnValue([sampleRow, { ...sampleRow, id: 2, name: 'Another' }]);

      const result = await getFilters(1);

      expect(result).toHaveLength(2);
      expect(result[0].config).toEqual(sampleFilterConfig);
      expect(result[0].is_default).toBe(false);
      expect(result[1].name).toBe('Another');
    });

    it('returns empty array when user has no filters', async () => {
      mockAll.mockReturnValue([]);
      const result = await getFilters(999);
      expect(result).toEqual([]);
    });

    it('converts is_default integer to boolean', async () => {
      mockAll.mockReturnValue([{ ...sampleRow, is_default: 1 }]);
      const result = await getFilters(1);
      expect(result[0].is_default).toBe(true);
    });
  });

  describe('getFilterById', () => {
    it('returns a filter when found', async () => {
      mockGet.mockReturnValue(sampleRow);
      const result = await getFilterById(1);
      expect(result).not.toBeNull();
      expect(result!.name).toBe('My Filter');
      expect(result!.config).toEqual(sampleFilterConfig);
    });

    it('returns null when filter not found', async () => {
      mockGet.mockReturnValue(undefined);
      const result = await getFilterById(999);
      expect(result).toBeNull();
    });
  });

  describe('updateFilter', () => {
    it('updates name and config, then returns the updated filter', async () => {
      mockRun.mockReturnValue({ changes: 1 });
      const updatedRow = { ...sampleRow, name: 'Updated', config: JSON.stringify({ query: 'updated' }) };
      mockGet.mockReturnValue(updatedRow);

      const result = await updateFilter(1, 'Updated', { query: 'updated' } as any);

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Updated');
    });

    it('returns null if filter does not exist after update', async () => {
      mockRun.mockReturnValue({ changes: 0 });
      mockGet.mockReturnValue(undefined);

      const result = await updateFilter(999, 'Nope', sampleFilterConfig);
      expect(result).toBeNull();
    });

    it('serializes config to JSON on update', async () => {
      mockRun.mockReturnValue({ changes: 1 });
      mockGet.mockReturnValue(sampleRow);

      await updateFilter(1, 'Name', sampleFilterConfig);

      const updateCall = mockRun.mock.calls[0];
      expect(typeof updateCall[0]).toBe('string'); // name
      expect(typeof updateCall[1]).toBe('string'); // JSON config
      expect(typeof updateCall[2]).toBe('number'); // filterId
    });
  });

  describe('deleteFilter', () => {
    it('returns true when filter is deleted', async () => {
      mockRun.mockReturnValue({ changes: 1 });
      const result = await deleteFilter(1);
      expect(result).toBe(true);
    });

    it('returns false when filter does not exist', async () => {
      mockRun.mockReturnValue({ changes: 0 });
      const result = await deleteFilter(999);
      expect(result).toBe(false);
    });

    it('calls prepare with DELETE query', async () => {
      mockRun.mockReturnValue({ changes: 1 });
      await deleteFilter(1);
      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('DELETE'));
    });
  });

  describe('setDefaultFilter', () => {
    it('unsets all defaults then sets the specified filter as default', async () => {
      mockRun.mockReturnValue({ changes: 1 });
      const result = await setDefaultFilter(1, 5);
      expect(result).toBe(true);
      // Two prepare calls: unset all, then set one
      expect(mockRun).toHaveBeenCalledWith(1);    // unset
      expect(mockRun).toHaveBeenCalledWith(5, 1); // set default
    });

    it('returns false when filter not found', async () => {
      mockRun.mockReturnValue({ changes: 0 });
      const result = await setDefaultFilter(1, 999);
      expect(result).toBe(false);
    });
  });

  describe('getDefaultFilter', () => {
    it('returns the default filter when one exists', async () => {
      mockGet.mockReturnValue({ ...sampleRow, is_default: 1 });
      const result = await getDefaultFilter(1);
      expect(result).not.toBeNull();
      expect(result!.is_default).toBe(true);
    });

    it('returns null when no default filter exists', async () => {
      mockGet.mockReturnValue(undefined);
      const result = await getDefaultFilter(999);
      expect(result).toBeNull();
    });

    it('queries with is_default = 1', async () => {
      mockGet.mockReturnValue(undefined);
      await getDefaultFilter(1);
      const prepareCall = mockPrepare.mock.calls[0][0] as string;
      expect(prepareCall).toContain('is_default');
    });
  });

  describe('duplicateFilter', () => {
    it('creates a copy of an existing filter with a new name', async () => {
      mockGet.mockReturnValueOnce(sampleRow); // getFilterById
      mockRun.mockReturnValue({ lastInsertRowid: 2, changes: 1 });
      mockGet.mockReturnValueOnce({ ...sampleRow, id: 2, name: 'Copy' }); // saveFilter's get

      const result = await duplicateFilter(1, 'Copy');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Copy');
      expect(result!.config).toEqual(sampleFilterConfig);
    });

    it('returns null when original filter does not exist', async () => {
      mockGet.mockReturnValue(undefined);
      const result = await duplicateFilter(999, 'Copy');
      expect(result).toBeNull();
    });

    it('copies the config from the original filter', async () => {
      mockGet.mockReturnValueOnce(sampleRow);
      mockRun.mockReturnValue({ lastInsertRowid: 2, changes: 1 });
      mockGet.mockReturnValueOnce({ ...sampleRow, id: 2, name: 'Copy' });

      await duplicateFilter(1, 'Copy');
      // saveFilter inserts with the original config
      const insertCall = mockRun.mock.calls.find(
        (call: any[]) => typeof call[2] === 'string' && call[2].includes('test')
      );
      expect(insertCall).toBeDefined();
    });
  });

  describe('applyFilter', () => {
    it('returns the filter config when filter exists', async () => {
      mockGet.mockReturnValue(sampleRow);
      const result = await applyFilter(1);
      expect(result).toEqual(sampleFilterConfig);
    });

    it('returns null when filter does not exist', async () => {
      mockGet.mockReturnValue(undefined);
      const result = await applyFilter(999);
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('handles config with empty filters', async () => {
      const emptyConfig: AdvancedSearchFilters = {};
      const row = { ...sampleRow, config: JSON.stringify(emptyConfig) };
      mockRun.mockReturnValue({ lastInsertRowid: 1, changes: 1 });
      mockGet.mockReturnValue(row);

      const result = await saveFilter(1, 'Empty', emptyConfig);
      expect(result.config).toEqual({});
    });

    it('handles config with all fields populated', async () => {
      const fullConfig: AdvancedSearchFilters = {
        query: 'search',
        name: 'Student',
        category: ['Math', 'Science'],
        rollNumber: 'R001',
        marksMin: 0,
        marksMax: 100,
        dateFrom: '2025-01-01',
        dateTo: '2025-12-31',
        admitCardStatus: 'uploaded',
        sortBy: 'marks',
        sortOrder: 'desc',
        limit: 10,
        offset: 0,
      };
      const row = { ...sampleRow, config: JSON.stringify(fullConfig) };
      mockRun.mockReturnValue({ lastInsertRowid: 1, changes: 1 });
      mockGet.mockReturnValue(row);

      const result = await saveFilter(1, 'Full', fullConfig);
      expect(result.config).toEqual(fullConfig);
    });

    it('handles special characters in filter name', async () => {
      const row = { ...sampleRow, name: "O'Brien's \"Filter\"" };
      mockRun.mockReturnValue({ lastInsertRowid: 1, changes: 1 });
      mockGet.mockReturnValue(row);

      const result = await saveFilter(1, "O'Brien's \"Filter\"", sampleFilterConfig);
      expect(result.name).toBe("O'Brien's \"Filter\"");
    });
  });
});
