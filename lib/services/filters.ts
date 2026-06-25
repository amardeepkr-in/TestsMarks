import db from '@/lib/db';
import type { AdvancedSearchFilters } from './search';

export interface SavedFilter {
  id: number;
  user_id: number;
  name: string;
  config: AdvancedSearchFilters;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface SavedFilterRow {
  id: number;
  user_id: number;
  name: string;
  config: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

/**
 * Save a new filter for a user
 */
export async function saveFilter(
  userId: number,
  name: string,
  config: AdvancedSearchFilters,
  isDefault: boolean = false
): Promise<SavedFilter> {
  try {
    // If setting as default, unset other defaults for this user
    if (isDefault) {
      const stmt = db.prepare(`
        UPDATE saved_filters
        SET is_default = 0
        WHERE user_id = ?
      `);
      stmt.run(userId);
    }

    const stmt = db.prepare(`
      INSERT INTO saved_filters (user_id, name, config, is_default)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
      userId,
      name,
      JSON.stringify(config),
      isDefault ? 1 : 0
    );

    const filter = db.prepare(`
      SELECT * FROM saved_filters WHERE id = ?
    `).get(result.lastInsertRowid) as SavedFilterRow;

    return {
      ...filter,
      config: JSON.parse(filter.config),
      is_default: Boolean(filter.is_default),
    };
  } catch (error) {
    console.error('Error saving filter:', error);
    throw error;
  }
}

/**
 * Get all filters for a user
 */
export async function getFilters(userId: number): Promise<SavedFilter[]> {
  try {
    const stmt = db.prepare(`
      SELECT * FROM saved_filters
      WHERE user_id = ?
      ORDER BY is_default DESC, name ASC
    `);

    const filters = stmt.all(userId) as SavedFilterRow[];

    return filters.map(filter => ({
      ...filter,
      config: JSON.parse(filter.config),
      is_default: Boolean(filter.is_default),
    }));
  } catch (error) {
    console.error('Error getting filters:', error);
    throw error;
  }
}

/**
 * Get a specific filter by ID
 */
export async function getFilterById(filterId: number): Promise<SavedFilter | null> {
  try {
    const stmt = db.prepare(`
      SELECT * FROM saved_filters WHERE id = ?
    `);

    const filter = stmt.get(filterId) as SavedFilterRow;

    if (!filter) {
      return null;
    }

    return {
      ...filter,
      config: JSON.parse(filter.config),
      is_default: Boolean(filter.is_default),
    };
  } catch (error) {
    console.error('Error getting filter by ID:', error);
    throw error;
  }
}

/**
 * Apply a saved filter (returns the filter config)
 */
export async function applyFilter(filterId: number): Promise<AdvancedSearchFilters | null> {
  try {
    const filter = await getFilterById(filterId);
    return filter ? filter.config : null;
  } catch (error) {
    console.error('Error applying filter:', error);
    throw error;
  }
}

/**
 * Update a saved filter
 */
export async function updateFilter(
  filterId: number,
  name: string,
  config: AdvancedSearchFilters
): Promise<SavedFilter | null> {
  try {
    const stmt = db.prepare(`
      UPDATE saved_filters
      SET name = ?, config = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(name, JSON.stringify(config), filterId);

    return await getFilterById(filterId);
  } catch (error) {
    console.error('Error updating filter:', error);
    throw error;
  }
}

/**
 * Delete a saved filter
 */
export async function deleteFilter(filterId: number): Promise<boolean> {
  try {
    const stmt = db.prepare(`
      DELETE FROM saved_filters WHERE id = ?
    `);

    const result = stmt.run(filterId);
    return result.changes > 0;
  } catch (error) {
    console.error('Error deleting filter:', error);
    throw error;
  }
}

/**
 * Set a filter as default for a user
 */
export async function setDefaultFilter(userId: number, filterId: number): Promise<boolean> {
  try {
    // First, unset all defaults for this user
    const unsetStmt = db.prepare(`
      UPDATE saved_filters
      SET is_default = 0
      WHERE user_id = ?
    `);
    unsetStmt.run(userId);

    // Then set the specified filter as default
    const setStmt = db.prepare(`
      UPDATE saved_filters
      SET is_default = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `);

    const result = setStmt.run(filterId, userId);
    return result.changes > 0;
  } catch (error) {
    console.error('Error setting default filter:', error);
    throw error;
  }
}

/**
 * Get the default filter for a user
 */
export async function getDefaultFilter(userId: number): Promise<SavedFilter | null> {
  try {
    const stmt = db.prepare(`
      SELECT * FROM saved_filters
      WHERE user_id = ? AND is_default = 1
      LIMIT 1
    `);

    const filter = stmt.get(userId) as SavedFilterRow;

    if (!filter) {
      return null;
    }

    return {
      ...filter,
      config: JSON.parse(filter.config),
      is_default: Boolean(filter.is_default),
    };
  } catch (error) {
    console.error('Error getting default filter:', error);
    throw error;
  }
}

/**
 * Duplicate a filter
 */
export async function duplicateFilter(
  filterId: number,
  newName: string
): Promise<SavedFilter | null> {
  try {
    const originalFilter = await getFilterById(filterId);

    if (!originalFilter) {
      return null;
    }

    return await saveFilter(
      originalFilter.user_id,
      newName,
      originalFilter.config,
      false
    );
  } catch (error) {
    console.error('Error duplicating filter:', error);
    throw error;
  }
}


