import db from '@/lib/db';
import type { Submission } from '@/lib/types';

export interface SearchOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'date' | 'marks' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface AdvancedSearchFilters {
  query?: string;
  name?: string;
  category?: string[];
  rollNumber?: string;
  marksMin?: number;
  marksMax?: number;
  dateFrom?: string;
  dateTo?: string;
  admitCardStatus?: 'uploaded' | 'not_uploaded' | 'all';
  sortBy?: 'date' | 'marks' | 'name' | 'roll';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface SearchResult extends Submission {
  relevance?: number;
  snippet?: string;
}

/**
 * Initialize FTS5 virtual table for full-text search
 */
export function initializeFTS5(): void {
  try {
    // Create FTS5 virtual table if it doesn't exist
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS submissions_fts USING fts5(
        name,
        roll,
        category,
        content='submissions',
        content_rowid='id'
      );
    `);

    // Create triggers to keep FTS5 table in sync
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS submissions_ai AFTER INSERT ON submissions BEGIN
        INSERT INTO submissions_fts(rowid, name, roll, category)
        VALUES (new.id, new.name, new.roll, new.category);
      END;
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS submissions_ad AFTER DELETE ON submissions BEGIN
        DELETE FROM submissions_fts WHERE rowid = old.id;
      END;
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS submissions_au AFTER UPDATE ON submissions BEGIN
        UPDATE submissions_fts
        SET name = new.name,
            roll = new.roll,
            category = new.category
        WHERE rowid = new.id;
      END;
    `);

    // Populate FTS5 table with existing data
    db.exec(`
      INSERT OR REPLACE INTO submissions_fts(rowid, name, roll, category)
      SELECT id, name, roll, category FROM submissions;
    `);

    console.log('FTS5 initialized successfully');
  } catch (error) {
    console.error('Error initializing FTS5:', error);
    throw error;
  }
}

/**
 * Perform full-text search with fuzzy matching and relevance scoring
 */
export function fullTextSearch(
  query: string,
  options: SearchOptions = {}
): SearchResult[] {
  const {
    limit = 50,
    offset = 0,
    sortBy = 'relevance',
    sortOrder = 'desc',
  } = options;

  if (!query || query.trim().length === 0) {
    return [];
  }

  try {
    // Sanitize query for FTS5
    const sanitizedQuery = query.trim().replace(/[^\w\s]/g, '');

    // Build FTS5 query with fuzzy matching
    const ftsQuery = sanitizedQuery.split(/\s+/).map(term => `${term}*`).join(' OR ');

    let orderByClause = '';
    if (sortBy === 'relevance') {
      orderByClause = 'ORDER BY rank';
    } else if (sortBy === 'date') {
      orderByClause = `ORDER BY s.created_at ${sortOrder.toUpperCase()}`;
    } else if (sortBy === 'marks') {
      orderByClause = `ORDER BY s.marks ${sortOrder.toUpperCase()}`;
    } else if (sortBy === 'name') {
      orderByClause = `ORDER BY s.name ${sortOrder.toUpperCase()}`;
    }

    const sql = `
      SELECT
        s.*,
        fts.rank as relevance,
        snippet(submissions_fts, 0, '<mark>', '</mark>', '...', 32) as name_snippet,
        snippet(submissions_fts, 1, '<mark>', '</mark>', '...', 32) as roll_snippet
      FROM submissions_fts fts
      INNER JOIN submissions s ON s.id = fts.rowid
      WHERE submissions_fts MATCH ?
      ${orderByClause}
      LIMIT ? OFFSET ?
    `;

    const results = db.prepare(sql).all(ftsQuery, limit, offset) as Record<string, unknown>[];

    return results.map((result) => ({
      ...result,
      snippet: (result.name_snippet as string) || (result.roll_snippet as string),
    })) as SearchResult[];
  } catch (error) {
    console.error('Full-text search error:', error);
    throw error;
  }
}

/**
 * Advanced search with multiple filter criteria
 */
export function advancedSearch(
  filters: AdvancedSearchFilters
): { results: Submission[]; total: number } {
  const {
    query,
    name,
    category,
    rollNumber,
    marksMin,
    marksMax,
    dateFrom,
    dateTo,
    admitCardStatus,
    sortBy = 'date',
    sortOrder = 'desc',
    limit = 50,
    offset = 0,
  } = filters;

  try {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    // Full-text search condition
    if (query && query.trim()) {
      const sanitizedQuery = query.trim().replace(/[^\w\s]/g, '');
      const ftsQuery = sanitizedQuery.split(/\s+/).map(term => `${term}*`).join(' OR ');

      conditions.push(`s.id IN (
        SELECT rowid FROM submissions_fts WHERE submissions_fts MATCH ?
      )`);
      params.push(ftsQuery);
    }

    // Name filter (partial match)
    if (name && name.trim()) {
      conditions.push('s.name LIKE ?');
      params.push(`%${name.trim()}%`);
    }

    // Category filter (multiple)
    if (category && category.length > 0) {
      const placeholders = category.map(() => '?').join(',');
      conditions.push(`s.category IN (${placeholders})`);
      params.push(...category);
    }

    // Roll number filter (partial match)
    if (rollNumber && rollNumber.trim()) {
      conditions.push('s.roll_number LIKE ?');
      params.push(`%${rollNumber.trim()}%`);
    }

    // Marks range filter
    if (marksMin !== undefined) {
      conditions.push('s.marks >= ?');
      params.push(marksMin);
    }
    if (marksMax !== undefined) {
      conditions.push('s.marks <= ?');
      params.push(marksMax);
    }

    // Date range filter
    if (dateFrom) {
      conditions.push('DATE(s.created_at) >= DATE(?)');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('DATE(s.created_at) <= DATE(?)');
      params.push(dateTo);
    }

    // Admit card status filter
    if (admitCardStatus && admitCardStatus !== 'all') {
      if (admitCardStatus === 'uploaded') {
        conditions.push('s.admit_card_path IS NOT NULL');
      } else if (admitCardStatus === 'not_uploaded') {
        conditions.push('s.admit_card_path IS NULL');
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Build ORDER BY clause
    let orderByClause = '';
    const sortColumn = sortBy === 'date' ? 's.created_at'
                     : sortBy === 'marks' ? 's.marks'
                     : sortBy === 'name' ? 's.name'
                     : sortBy === 'roll' ? 's.roll_number'
                     : 's.created_at';
    orderByClause = `ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}`;

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM submissions s ${whereClause}`;
    const countResult = db.prepare(countSql).get(...params) as { total: number } | undefined;
    const total = countResult?.total || 0;

    // Get results
    const sql = `
      SELECT s.* FROM submissions s
      ${whereClause}
      ${orderByClause}
      LIMIT ? OFFSET ?
    `;
    const results = db.prepare(sql).all(...params, limit, offset) as Submission[];

    return { results, total };
  } catch (error) {
    console.error('Advanced search error:', error);
    throw error;
  }
}

/**
 * Get search suggestions for autocomplete
 */
export function searchSuggestions(query: string): string[] {
  if (!query || query.trim().length < 2) {
    return [];
  }

  try {
    const sanitizedQuery = query.trim().replace(/[^\w\s]/g, '');
    const pattern = `${sanitizedQuery}%`;

    const sql = `
      SELECT DISTINCT name FROM (
        SELECT name FROM submissions WHERE name LIKE ? LIMIT 5
        UNION
        SELECT roll as name FROM submissions WHERE roll LIKE ? LIMIT 5
        UNION
        SELECT category as name FROM submissions WHERE category LIKE ? LIMIT 5
      )
      LIMIT 10
    `;

    const results = db.prepare(sql).all(pattern, pattern, pattern) as { name: string }[];
    return results.map((r: { name: string }) => r.name);
  } catch (error) {
    console.error('Search suggestions error:', error);
    return [];
  }
}

/**
 * Get popular search terms
 */
export function getPopularSearchTerms(limit: number = 10): string[] {
  try {
    const sql = `
      SELECT category, COUNT(*) as count
      FROM submissions
      GROUP BY category
      ORDER BY count DESC
      LIMIT ?
    `;

    const results = db.prepare(sql).all(limit) as { category: string }[];
    return results.map((r: { category: string }) => r.category);
  } catch (error) {
    console.error('Popular search terms error:', error);
    return [];
  }
}


