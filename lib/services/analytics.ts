import db from '../db';

export interface CategoryDistribution {
  name: string;
  value: number;
}

export interface MarksDistribution {
  range: string;
  count: number;
}

export interface TimeSeriesData {
  date: string;
  count: number;
  avgMarks: number;
}

export interface TopPerformer {
  name: string;
  roll: string;
  marks: number;
}

export interface CategoryPerformance {
  category: string;
  avg: number;
  min: number;
  max: number;
  count: number;
}

export interface PassFailStats {
  passed: number;
  failed: number;
  passRate: number;
}

export interface GradeDistribution {
  grade: string;
  count: number;
}

export interface AnalyticsData {
  categoryDistribution: CategoryDistribution[];
  marksDistribution: MarksDistribution[];
  timeSeriesData: TimeSeriesData[];
  topPerformers: TopPerformer[];
  categoryPerformance: CategoryPerformance[];
  passFailStats: PassFailStats;
  gradeDistribution: GradeDistribution[];
}

function getGrade(marks: number): string {
  if (marks >= 90) return 'A+';
  if (marks >= 80) return 'A';
  if (marks >= 70) return 'B+';
  if (marks >= 60) return 'B';
  if (marks >= 50) return 'C';
  if (marks >= 40) return 'D';
  return 'F';
}

export function getAnalyticsData(
  startDate?: string,
  endDate?: string,
  category?: string
): AnalyticsData {
  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];

  if (startDate) {
    whereClause += ' AND created_at >= ?';
    params.push(startDate);
  }

  if (endDate) {
    whereClause += ' AND created_at <= ?';
    params.push(endDate);
  }

  if (category) {
    whereClause += ' AND category = ?';
    params.push(category);
  }

  // Category Distribution
  const categoryDistribution = db
    .prepare(
      `SELECT category as name, COUNT(*) as value
       FROM submissions
       ${whereClause}
       GROUP BY category
       ORDER BY value DESC`
    )
    .all(...params) as CategoryDistribution[];

  // Marks Distribution
  const allSubmissions = db
    .prepare(`SELECT marks FROM submissions ${whereClause}`)
    .all(...params) as { marks: string }[];

  const marksRanges = [
    { range: '0-39', min: 0, max: 39 },
    { range: '40-59', min: 40, max: 59 },
    { range: '60-74', min: 60, max: 74 },
    { range: '75-89', min: 75, max: 89 },
    { range: '90-100', min: 90, max: 100 },
  ];

  const marksDistribution: MarksDistribution[] = marksRanges.map((r) => {
    const count = allSubmissions.filter((s) => {
      const marks = parseFloat(s.marks);
      return marks >= r.min && marks <= r.max;
    }).length;
    return { range: r.range, count };
  });

  // Time Series Data (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  const timeSeriesQuery = `
    SELECT
      DATE(created_at) as date,
      COUNT(*) as count,
      AVG(CAST(marks AS REAL)) as avgMarks
    FROM submissions
    WHERE created_at >= ?
    ${category ? 'AND category = ?' : ''}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  const timeSeriesParams = category
    ? [thirtyDaysAgoStr, category]
    : [thirtyDaysAgoStr];

  const timeSeriesData = (db
    .prepare(timeSeriesQuery)
    .all(...timeSeriesParams) as Record<string, unknown>[])
    .map((row) => ({
      date: row.date as string,
      count: row.count as number,
      avgMarks: Math.round((row.avgMarks as number) * 100) / 100,
    })) as TimeSeriesData[];

  // Top Performers (top 10)
  const topPerformers = db
    .prepare(
      `SELECT name, roll, CAST(marks AS REAL) as marks
       FROM submissions
       ${whereClause}
       ORDER BY CAST(marks AS REAL) DESC
       LIMIT 10`
    )
    .all(...params) as TopPerformer[];

  // Category Performance
  const categoryPerformance = (db
    .prepare(
      `SELECT
        category,
        AVG(CAST(marks AS REAL)) as avg,
        MIN(CAST(marks AS REAL)) as min,
        MAX(CAST(marks AS REAL)) as max,
        COUNT(*) as count
       FROM submissions
       ${whereClause}
       GROUP BY category
        ORDER BY avg DESC`
    )
    .all(...params) as Record<string, unknown>[])
    .map((row) => ({
      category: row.category as string,
      avg: Math.round((row.avg as number) * 100) / 100,
      min: row.min as number,
      max: row.max as number,
      count: row.count as number,
    })) as CategoryPerformance[];

  // Pass/Fail Stats (assuming 40 is passing marks)
  const passed = allSubmissions.filter((s) => parseFloat(s.marks) >= 40).length;
  const failed = allSubmissions.filter((s) => parseFloat(s.marks) < 40).length;
  const total = allSubmissions.length;
  const passRate = total > 0 ? Math.round((passed / total) * 100 * 100) / 100 : 0;

  const passFailStats: PassFailStats = {
    passed,
    failed,
    passRate,
  };

  // Grade Distribution
  const gradeMap = new Map<string, number>();
  const grades = ['A+', 'A', 'B+', 'B', 'C', 'D', 'F'];
  grades.forEach((g) => gradeMap.set(g, 0));

  allSubmissions.forEach((s) => {
    const marks = parseFloat(s.marks);
    const grade = getGrade(marks);
    gradeMap.set(grade, (gradeMap.get(grade) || 0) + 1);
  });

  const gradeDistribution: GradeDistribution[] = grades.map((grade) => ({
    grade,
    count: gradeMap.get(grade) || 0,
  }));

  return {
    categoryDistribution,
    marksDistribution,
    timeSeriesData,
    topPerformers,
    categoryPerformance,
    passFailStats,
    gradeDistribution,
  };
}


