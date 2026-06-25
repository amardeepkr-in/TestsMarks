import ExcelJS from 'exceljs';
import db from '../db';

export interface ImportRecord {
  name: string;
  category: string;
  roll: string;
  marks: string;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ImportOptions {
  skipDuplicates?: boolean;
  updateExisting?: boolean;
  sendNotifications?: boolean;
}

export interface ImportSummary {
  success: number;
  failed: number;
  skipped: number;
  errors: ValidationError[];
}

// Parse CSV data
export function parseCSV(fileContent: string): ImportRecord[] {
  const lines = fileContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file must contain header and at least one data row');
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const records: ImportRecord[] = [];

  // Validate headers
  const requiredHeaders = ['name', 'category', 'roll', 'marks'];
  const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map(v => v.trim());
    const record: Record<string, string> = {};

    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });

    records.push({
      name: record.name,
      category: record.category,
      roll: record.roll,
      marks: record.marks,
    });
  }

  return records;
}

// Parse Excel data
export async function parseExcel(fileBuffer: Buffer): Promise<ImportRecord[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Excel file must contain at least one worksheet');
  }

  const records: ImportRecord[] = [];
  const headers: string[] = [];

  // Get headers from first row
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value).toLowerCase().trim();
  });

  // Validate headers
  const requiredHeaders = ['name', 'category', 'roll', 'marks'];
  const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
  }

  // Get column indices
  const nameIdx = headers.indexOf('name');
  const categoryIdx = headers.indexOf('category');
  const rollIdx = headers.indexOf('roll');
  const marksIdx = headers.indexOf('marks');

  // Parse data rows
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header row

    const record: ImportRecord = {
      name: String(row.getCell(nameIdx + 1).value || '').trim(),
      category: String(row.getCell(categoryIdx + 1).value || '').trim(),
      roll: String(row.getCell(rollIdx + 1).value || '').trim(),
      marks: String(row.getCell(marksIdx + 1).value || '').trim(),
    };

    // Only add non-empty rows
    if (record.name || record.category || record.roll || record.marks) {
      records.push(record);
    }
  });

  return records;
}

// Validate import data
export function validateImportData(data: ImportRecord[]): ValidationError[] {
  const errors: ValidationError[] = [];

  data.forEach((record, index) => {
    const rowNumber = index + 2; // +2 because index starts at 0 and row 1 is header

    // Validate name
    if (!record.name || record.name.trim().length === 0) {
      errors.push({
        row: rowNumber,
        field: 'name',
        message: 'Name is required',
      });
    } else if (record.name.length > 100) {
      errors.push({
        row: rowNumber,
        field: 'name',
        message: 'Name must be less than 100 characters',
      });
    }

    // Validate category
    if (!record.category || record.category.trim().length === 0) {
      errors.push({
        row: rowNumber,
        field: 'category',
        message: 'Category is required',
      });
    } else if (record.category.length > 50) {
      errors.push({
        row: rowNumber,
        field: 'category',
        message: 'Category must be less than 50 characters',
      });
    }

    // Validate roll number
    if (!record.roll || record.roll.trim().length === 0) {
      errors.push({
        row: rowNumber,
        field: 'roll',
        message: 'Roll number is required',
      });
    } else if (record.roll.length > 20) {
      errors.push({
        row: rowNumber,
        field: 'roll',
        message: 'Roll number must be less than 20 characters',
      });
    }

    // Validate marks
    if (!record.marks || record.marks.trim().length === 0) {
      errors.push({
        row: rowNumber,
        field: 'marks',
        message: 'Marks is required',
      });
    } else {
      const marks = parseFloat(record.marks);
      if (isNaN(marks)) {
        errors.push({
          row: rowNumber,
          field: 'marks',
          message: 'Marks must be a valid number',
        });
      } else if (marks < 0 || marks > 100) {
        errors.push({
          row: rowNumber,
          field: 'marks',
          message: 'Marks must be between 0 and 100',
        });
      }
    }
  });

  return errors;
}

// Bulk import submissions
export function bulkImportSubmissions(
  data: ImportRecord[],
  options: ImportOptions = {}
): ImportSummary {
  const {
    skipDuplicates = true,
    updateExisting = false,
    sendNotifications = false,
  } = options;

  const summary: ImportSummary = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  // Validate all data first
  const validationErrors = validateImportData(data);
  if (validationErrors.length > 0) {
    summary.errors = validationErrors;
    summary.failed = data.length;
    return summary;
  }

  // Process each record
  data.forEach((record, index) => {
    const rowNumber = index + 2;

    try {
      // Check for existing submission with same roll number
      const existing = db
        .prepare('SELECT id FROM submissions WHERE roll = ?')
        .get(record.roll) as { id: number } | undefined;

      if (existing) {
        if (skipDuplicates && !updateExisting) {
          summary.skipped++;
          return;
        }

        if (updateExisting) {
          // Update existing record
          db.prepare(
            `UPDATE submissions
             SET name = ?, category = ?, marks = ?
             WHERE roll = ?`
          ).run(record.name, record.category, record.marks, record.roll);
          summary.success++;
        } else {
          summary.skipped++;
        }
      } else {
        // Insert new record
        db.prepare(
          `INSERT INTO submissions (name, category, roll, marks)
           VALUES (?, ?, ?, ?)`
        ).run(record.name, record.category, record.roll, record.marks);
        summary.success++;
      }

      // TODO: Send notifications if enabled
      if (sendNotifications) {
        // Implement notification logic here
      }
    } catch (error) {
      summary.failed++;
      summary.errors.push({
        row: rowNumber,
        field: 'general',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return summary;
}

// Helper function to detect file type
export function detectFileType(filename: string): 'csv' | 'excel' | 'unknown' {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls') return 'excel';
  return 'unknown';
}

// Main import function that handles both CSV and Excel
export async function importFromFile(
  file: Buffer,
  filename: string,
  options: ImportOptions = {}
): Promise<ImportSummary> {
  const fileType = detectFileType(filename);

  if (fileType === 'unknown') {
    return {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [
        {
          row: 0,
          field: 'file',
          message: 'Unsupported file type. Please use CSV or Excel files.',
        },
      ],
    };
  }

  try {
    let records: ImportRecord[];

    if (fileType === 'csv') {
      const content = file.toString('utf-8');
      records = parseCSV(content);
    } else {
      records = await parseExcel(file);
    }

    return bulkImportSubmissions(records, options);
  } catch (error) {
    return {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [
        {
          row: 0,
          field: 'file',
          message: error instanceof Error ? error.message : 'Failed to parse file',
        },
      ],
    };
  }
}


