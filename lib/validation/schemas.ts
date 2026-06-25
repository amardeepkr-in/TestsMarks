import { z } from 'zod';

/**
 * Submission validation schema
 * Validates student submission data
 */
export const submissionSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(200, 'Name must be under 200 characters')
    .trim(),
  category: z
    .string()
    .min(1, 'Category is required')
    .max(100, 'Category must be under 100 characters')
    .trim(),
  roll: z
    .string()
    .min(1, 'Roll number is required')
    .max(50, 'Roll number must be under 50 characters')
    .trim(),
  marks: z
    .string()
    .min(1, 'Marks are required')
    .max(20, 'Marks must be under 20 characters')
    .trim()
    .refine(
      (val) => {
        const num = parseFloat(val);
        return isNaN(num) || (num >= 0 && num <= 1000);
      },
      { message: 'Marks must be between 0 and 1000' }
    ),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;

/**
 * Admin user validation schema
 * Validates admin user creation/update
 */
export const adminUserSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be under 50 characters')
    .trim()
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores, and hyphens'
    ),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be under 100 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
      'Password must contain at least one special character'
    ),
});

export type AdminUserInput = z.infer<typeof adminUserSchema>;

/**
 * Login validation schema
 * Validates login credentials
 */
export const loginSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be under 50 characters')
    .trim(),
  password: z
    .string()
    .min(4, 'Password must be at least 4 characters')
    .max(100, 'Password must be under 100 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * File upload validation schema
 * Validates file uploads (max 10MB, specific types)
 */
export const fileUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size > 0, 'File is required')
    .refine(
      (file) => file.size <= 10 * 1024 * 1024,
      'File size must be under 10MB'
    )
    .refine(
      (file) => {
        const allowedTypes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'application/pdf',
        ];
        return allowedTypes.includes(file.type);
      },
      'Only JPG, PNG, or PDF files are allowed'
    ),
});

export type FileUploadInput = z.infer<typeof fileUploadSchema>;

/**
 * Settings update validation schema
 */
export const settingsSchema = z.object({
  field: z.enum(['allow_submissions', 'allow_user_edits', 'allow_uploads']),
  value: z.number().int().min(0).max(1),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

/**
 * Submission update validation schema
 */
export const submissionUpdateSchema = z.object({
  id: z.number().int().positive(),
  field: z.enum(['name', 'category', 'roll', 'marks']),
  value: z.string().trim(),
});

export type SubmissionUpdateInput = z.infer<typeof submissionUpdateSchema>;

/**
 * Password change validation schema
 */
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(100, 'New password must be under 100 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
      'Password must contain at least one special character'
    ),
});

export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

/**
 * Search query validation schema
 */
export const searchSchema = z.object({
  query: z.string().max(200, 'Search query must be under 200 characters').trim(),
});

export type SearchInput = z.infer<typeof searchSchema>;

/**
 * ID validation schema
 */
export const idSchema = z.object({
  id: z.number().int().positive('ID must be a positive integer'),
});

export type IdInput = z.infer<typeof idSchema>;


