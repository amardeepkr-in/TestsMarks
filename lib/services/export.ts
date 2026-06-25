import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { getAnalyticsData } from './analytics';
import type { Submission } from '@/lib/types';

export interface ExportStats {
  total: number;
  avgMarks: number;
  highestMarks: number;
  lowestMarks: number;
  passRate: number;
}

// Excel Export
export async function exportToExcel(
  submissions: Submission[],
  stats: ExportStats
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TestMarks System';
  workbook.created = new Date();

  // Sheet 1: All Submissions
  const submissionsSheet = workbook.addWorksheet('Submissions', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  });

  // Define columns
  submissionsSheet.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Roll Number', key: 'roll', width: 15 },
    { header: 'Marks', key: 'marks', width: 10 },
    { header: 'Grade', key: 'grade', width: 10 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Created At', key: 'created_at', width: 20 },
  ];

  // Style header row
  submissionsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  submissionsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  submissionsSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  // Add data rows
  submissions.forEach((sub) => {
    const marks = parseFloat(sub.marks);
    const grade = getGrade(marks);
    const status = marks >= 40 ? 'Pass' : 'Fail';

    const row = submissionsSheet.addRow({
      id: sub.id,
      name: sub.name,
      category: sub.category,
      roll: sub.roll,
      marks: marks,
      grade: grade,
      status: status,
      created_at: new Date(sub.created_at).toLocaleString(),
    });

    // Color code status
    const statusCell = row.getCell('status');
    statusCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: status === 'Pass' ? 'FF90EE90' : 'FFFF6B6B' },
    };

    // Color code grade
    const gradeCell = row.getCell('grade');
    if (grade === 'A+' || grade === 'A') {
      gradeCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF90EE90' },
      };
    } else if (grade === 'F') {
      gradeCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFF6B6B' },
      };
    }
  });

  // Add borders to all cells
  submissionsSheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  });

  // Sheet 2: Statistics Summary
  const statsSheet = workbook.addWorksheet('Statistics');
  statsSheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
  ];

  statsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  statsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };

  statsSheet.addRows([
    { metric: 'Total Submissions', value: stats.total },
    { metric: 'Average Marks', value: stats.avgMarks.toFixed(2) },
    { metric: 'Highest Marks', value: stats.highestMarks },
    { metric: 'Lowest Marks', value: stats.lowestMarks },
    { metric: 'Pass Rate', value: `${stats.passRate.toFixed(2)}%` },
  ]);

  statsSheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  });

  // Sheet 3: Category Breakdown
  const categorySheet = workbook.addWorksheet('Category Breakdown');
  categorySheet.columns = [
    { header: 'Category', key: 'category', width: 25 },
    { header: 'Count', key: 'count', width: 12 },
    { header: 'Average', key: 'avg', width: 12 },
    { header: 'Minimum', key: 'min', width: 12 },
    { header: 'Maximum', key: 'max', width: 12 },
  ];

  categorySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  categorySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };

  // Calculate category stats
  const categoryMap = new Map<string, number[]>();
  submissions.forEach((sub) => {
    const marks = parseFloat(sub.marks);
    if (!categoryMap.has(sub.category)) {
      categoryMap.set(sub.category, []);
    }
    categoryMap.get(sub.category)!.push(marks);
  });

  categoryMap.forEach((marksList, category) => {
    const count = marksList.length;
    const avg = marksList.reduce((a, b) => a + b, 0) / count;
    const min = Math.min(...marksList);
    const max = Math.max(...marksList);

    categorySheet.addRow({
      category,
      count,
      avg: avg.toFixed(2),
      min,
      max,
    });
  });

  categorySheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// PDF Export
export async function exportToPDF(
  submissions: Submission[],
  type: 'admit-card' | 'mark-sheet' | 'report' | 'bulk-admit-cards',
  _options?: Record<string, unknown>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      switch (type) {
        case 'admit-card':
          generateAdmitCard(doc, submissions[0]);
          break;
        case 'mark-sheet':
          generateMarkSheet(doc, submissions[0]);
          break;
        case 'report':
          generateReport(doc, submissions);
          break;
        case 'bulk-admit-cards':
          generateBulkAdmitCards(doc, submissions);
          break;
      }
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function generateAdmitCard(doc: PDFKit.PDFDocument, submission: Submission) {
  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('ADMIT CARD', { align: 'center' });
  doc.moveDown();

  // School/Institution Name
  doc.fontSize(16).text('TestMarks System', { align: 'center' });
  doc.moveDown(2);

  // Student Details
  doc.fontSize(12).font('Helvetica');
  doc.text(`Name: ${submission.name}`, { continued: false });
  doc.text(`Roll Number: ${submission.roll}`);
  doc.text(`Category: ${submission.category}`);
  doc.moveDown();

  // Instructions
  doc.fontSize(10).font('Helvetica-Bold').text('Instructions:');
  doc.font('Helvetica').fontSize(9);
  doc.list([
    'Bring this admit card to the examination hall',
    'Carry a valid ID proof',
    'Report 30 minutes before the exam',
    'Mobile phones are not allowed',
  ]);

  doc.moveDown(2);

  // Footer
  doc.fontSize(8).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
}

function generateMarkSheet(doc: PDFKit.PDFDocument, submission: Submission) {
  const marks = parseFloat(submission.marks);
  const grade = getGrade(marks);
  const status = marks >= 40 ? 'PASS' : 'FAIL';

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('MARK SHEET', { align: 'center' });
  doc.moveDown();

  doc.fontSize(16).text('TestMarks System', { align: 'center' });
  doc.moveDown(2);

  // Student Details
  doc.fontSize(12).font('Helvetica-Bold').text('Student Details:');
  doc.font('Helvetica').fontSize(11);
  doc.text(`Name: ${submission.name}`);
  doc.text(`Roll Number: ${submission.roll}`);
  doc.text(`Category: ${submission.category}`);
  doc.moveDown();

  // Marks Details
  doc.font('Helvetica-Bold').fontSize(12).text('Marks Details:');
  doc.font('Helvetica').fontSize(11);
  doc.text(`Marks Obtained: ${marks}`);
  doc.text(`Grade: ${grade}`);

  // Set color for status
  if (status === 'PASS') {
    doc.fillColor('green');
  } else {
    doc.fillColor('red');
  }
  doc.text(`Status: ${status}`);
  doc.fillColor('black');
  doc.moveDown(2);

  // Footer
  doc.fontSize(8).text(`Issue Date: ${new Date().toLocaleString()}`, { align: 'center' });
}

function generateReport(doc: PDFKit.PDFDocument, submissions: Submission[]) {
  // Header
  doc.fontSize(18).font('Helvetica-Bold').text('COMPREHENSIVE REPORT', { align: 'center' });
  doc.moveDown();

  // Summary Statistics
  const totalMarks = submissions.reduce((sum, s) => sum + parseFloat(s.marks), 0);
  const avgMarks = totalMarks / submissions.length;
  const maxMarks = Math.max(...submissions.map(s => parseFloat(s.marks)));
  const minMarks = Math.min(...submissions.map(s => parseFloat(s.marks)));
  const passed = submissions.filter(s => parseFloat(s.marks) >= 40).length;
  const passRate = (passed / submissions.length) * 100;

  doc.fontSize(12).font('Helvetica-Bold').text('Summary Statistics:');
  doc.font('Helvetica').fontSize(10);
  doc.text(`Total Submissions: ${submissions.length}`);
  doc.text(`Average Marks: ${avgMarks.toFixed(2)}`);
  doc.text(`Highest Marks: ${maxMarks}`);
  doc.text(`Lowest Marks: ${minMarks}`);
  doc.text(`Pass Rate: ${passRate.toFixed(2)}%`);
  doc.moveDown();

  // Top Performers
  const topPerformers = [...submissions]
    .sort((a, b) => parseFloat(b.marks) - parseFloat(a.marks))
    .slice(0, 10);

  doc.fontSize(12).font('Helvetica-Bold').text('Top 10 Performers:');
  doc.fontSize(9).font('Helvetica');

  topPerformers.forEach((sub, index) => {
    doc.text(`${index + 1}. ${sub.name} (${sub.roll}) - ${sub.marks} marks`);
  });

  doc.moveDown();
  doc.fontSize(8).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
}

function generateBulkAdmitCards(doc: PDFKit.PDFDocument, submissions: Submission[]) {
  submissions.forEach((submission, index) => {
    if (index > 0) {
      doc.addPage();
    }
    generateAdmitCard(doc, submission);
  });
}

// JSON Export
export function exportToJSON(submissions: Submission[], stats: ExportStats) {
  const analytics = getAnalyticsData();

  return {
    exportDate: new Date().toISOString(),
    summary: stats,
    submissions: submissions.map(sub => ({
      ...sub,
      marks: parseFloat(sub.marks),
      grade: getGrade(parseFloat(sub.marks)),
      status: parseFloat(sub.marks) >= 40 ? 'Pass' : 'Fail',
    })),
    analytics: {
      categoryDistribution: analytics.categoryDistribution,
      gradeDistribution: analytics.gradeDistribution,
      passFailStats: analytics.passFailStats,
    },
  };
}

// Helper function to get grade
function getGrade(marks: number): string {
  if (marks >= 90) return 'A+';
  if (marks >= 80) return 'A';
  if (marks >= 70) return 'B+';
  if (marks >= 60) return 'B';
  if (marks >= 50) return 'C';
  if (marks >= 40) return 'D';
  return 'F';
}


