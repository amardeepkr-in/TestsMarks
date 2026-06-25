import { describe, it, expect } from 'vitest';
import {
  submissionSchema,
  submissionUpdateSchema,
  adminUserSchema,
  loginSchema,
  settingsSchema,
  passwordChangeSchema,
  searchSchema,
  idSchema,
} from '@/lib/validation/schemas';

describe('submissionSchema', () => {
  const validSubmission = {
    name: 'John Doe',
    category: 'Math',
    roll: 'A123',
    marks: '85',
  };

  it('passes with valid data', () => {
    const result = submissionSchema.safeParse(validSubmission);
    expect(result.success).toBe(true);
  });

  it('trims whitespace from fields', () => {
    const result = submissionSchema.safeParse({
      name: '  John Doe  ',
      category: '  Math  ',
      roll: '  A123  ',
      marks: '  85  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('John Doe');
      expect(result.data.category).toBe('Math');
      expect(result.data.roll).toBe('A123');
      expect(result.data.marks).toBe('85');
    }
  });

  it('fails when name is missing', () => {
    const result = submissionSchema.safeParse({
      category: 'Math',
      roll: 'A123',
      marks: '85',
    });
    expect(result.success).toBe(false);
  });

  it('fails when category is missing', () => {
    const result = submissionSchema.safeParse({
      name: 'John',
      roll: 'A123',
      marks: '85',
    });
    expect(result.success).toBe(false);
  });

  it('fails when roll is missing', () => {
    const result = submissionSchema.safeParse({
      name: 'John',
      category: 'Math',
      marks: '85',
    });
    expect(result.success).toBe(false);
  });

  it('fails when marks is missing', () => {
    const result = submissionSchema.safeParse({
      name: 'John',
      category: 'Math',
      roll: 'A123',
    });
    expect(result.success).toBe(false);
  });

  it('fails when name is empty string', () => {
    const result = submissionSchema.safeParse({
      name: '',
      category: 'Math',
      roll: 'A123',
      marks: '85',
    });
    expect(result.success).toBe(false);
  });

  it('fails when name exceeds 200 characters', () => {
    const result = submissionSchema.safeParse({
      name: 'A'.repeat(201),
      category: 'Math',
      roll: 'A123',
      marks: '85',
    });
    expect(result.success).toBe(false);
  });

  it('passes with name at exactly 200 characters', () => {
    const result = submissionSchema.safeParse({
      name: 'A'.repeat(200),
      category: 'Math',
      roll: 'A123',
      marks: '85',
    });
    expect(result.success).toBe(true);
  });

  it('fails when category exceeds 100 characters', () => {
    const result = submissionSchema.safeParse({
      name: 'John',
      category: 'A'.repeat(101),
      roll: 'A123',
      marks: '85',
    });
    expect(result.success).toBe(false);
  });

  it('fails when roll exceeds 50 characters', () => {
    const result = submissionSchema.safeParse({
      name: 'John',
      category: 'Math',
      roll: 'A'.repeat(51),
      marks: '85',
    });
    expect(result.success).toBe(false);
  });

  it('fails when marks exceeds 20 characters', () => {
    const result = submissionSchema.safeParse({
      name: 'John',
      category: 'Math',
      roll: 'A123',
      marks: '1'.repeat(21),
    });
    expect(result.success).toBe(false);
  });

  it('fails when marks is not a number between 0 and 1000', () => {
    const result = submissionSchema.safeParse({
      name: 'John',
      category: 'Math',
      roll: 'A123',
      marks: '1001',
    });
    expect(result.success).toBe(false);
  });

  it('passes with marks at boundary 0', () => {
    const result = submissionSchema.safeParse({
      name: 'John',
      category: 'Math',
      roll: 'A123',
      marks: '0',
    });
    expect(result.success).toBe(true);
  });

  it('passes with marks at boundary 1000', () => {
    const result = submissionSchema.safeParse({
      name: 'John',
      category: 'Math',
      roll: 'A123',
      marks: '1000',
    });
    expect(result.success).toBe(true);
  });

  it('passes with non-numeric marks (NaN is allowed by refine)', () => {
    const result = submissionSchema.safeParse({
      name: 'John',
      category: 'Math',
      roll: 'A123',
      marks: 'abc',
    });
    expect(result.success).toBe(true);
  });

  it('fails with numeric type instead of string', () => {
    const result = submissionSchema.safeParse({
      name: 123,
      category: 'Math',
      roll: 'A123',
      marks: '85',
    });
    expect(result.success).toBe(false);
  });
});

describe('submissionUpdateSchema', () => {
  it('passes with valid data', () => {
    const result = submissionUpdateSchema.safeParse({
      id: 1,
      field: 'name',
      value: 'New Name',
    });
    expect(result.success).toBe(true);
  });

  it('passes with all valid field values', () => {
    for (const field of ['name', 'category', 'roll', 'marks']) {
      const result = submissionUpdateSchema.safeParse({
        id: 1,
        field,
        value: 'test',
      });
      expect(result.success).toBe(true);
    }
  });

  it('fails when id is missing', () => {
    const result = submissionUpdateSchema.safeParse({
      field: 'name',
      value: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('fails when id is zero', () => {
    const result = submissionUpdateSchema.safeParse({
      id: 0,
      field: 'name',
      value: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('fails when id is negative', () => {
    const result = submissionUpdateSchema.safeParse({
      id: -1,
      field: 'name',
      value: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('fails when field is invalid', () => {
    const result = submissionUpdateSchema.safeParse({
      id: 1,
      field: 'invalid_field',
      value: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('fails when field is missing', () => {
    const result = submissionUpdateSchema.safeParse({
      id: 1,
      value: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('fails when value is missing', () => {
    const result = submissionUpdateSchema.safeParse({
      id: 1,
      field: 'name',
    });
    expect(result.success).toBe(false);
  });

  it('trims whitespace from value', () => {
    const result = submissionUpdateSchema.safeParse({
      id: 1,
      field: 'name',
      value: '  trimmed  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.value).toBe('trimmed');
    }
  });

  it('allows empty string value', () => {
    const result = submissionUpdateSchema.safeParse({
      id: 1,
      field: 'name',
      value: '',
    });
    expect(result.success).toBe(true);
  });
});

describe('adminUserSchema', () => {
  const validUser = {
    username: 'admin_user',
    password: 'SecurePass1!',
  };

  it('passes with valid data', () => {
    const result = adminUserSchema.safeParse(validUser);
    expect(result.success).toBe(true);
  });

  it('fails when username is missing', () => {
    const result = adminUserSchema.safeParse({
      password: 'SecurePass1!',
    });
    expect(result.success).toBe(false);
  });

  it('fails when password is missing', () => {
    const result = adminUserSchema.safeParse({
      username: 'admin_user',
    });
    expect(result.success).toBe(false);
  });

  it('fails when username is too short', () => {
    const result = adminUserSchema.safeParse({
      username: 'ab',
      password: 'SecurePass1!',
    });
    expect(result.success).toBe(false);
  });

  it('passes with username at exactly 3 characters', () => {
    const result = adminUserSchema.safeParse({
      username: 'abc',
      password: 'SecurePass1!',
    });
    expect(result.success).toBe(true);
  });

  it('fails when username exceeds 50 characters', () => {
    const result = adminUserSchema.safeParse({
      username: 'a'.repeat(51),
      password: 'SecurePass1!',
    });
    expect(result.success).toBe(false);
  });

  it('fails when username contains special characters', () => {
    const result = adminUserSchema.safeParse({
      username: 'admin@user',
      password: 'SecurePass1!',
    });
    expect(result.success).toBe(false);
  });

  it('allows underscores and hyphens in username', () => {
    const result = adminUserSchema.safeParse({
      username: 'admin_user-name',
      password: 'SecurePass1!',
    });
    expect(result.success).toBe(true);
  });

  it('fails when password is too short', () => {
    const result = adminUserSchema.safeParse({
      username: 'admin',
      password: 'Sh1!',
    });
    expect(result.success).toBe(false);
  });

  it('fails when password lacks uppercase', () => {
    const result = adminUserSchema.safeParse({
      username: 'admin',
      password: 'securepass1!',
    });
    expect(result.success).toBe(false);
  });

  it('fails when password lacks lowercase', () => {
    const result = adminUserSchema.safeParse({
      username: 'admin',
      password: 'SECUREPASS1!',
    });
    expect(result.success).toBe(false);
  });

  it('fails when password lacks number', () => {
    const result = adminUserSchema.safeParse({
      username: 'admin',
      password: 'SecurePass!',
    });
    expect(result.success).toBe(false);
  });

  it('fails when password lacks special character', () => {
    const result = adminUserSchema.safeParse({
      username: 'admin',
      password: 'SecurePass1',
    });
    expect(result.success).toBe(false);
  });

  it('fails when password exceeds 100 characters', () => {
    const result = adminUserSchema.safeParse({
      username: 'admin',
      password: 'A'.repeat(98) + 'a1!',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('passes with valid credentials', () => {
    const result = loginSchema.safeParse({
      username: 'admin',
      password: 'password',
    });
    expect(result.success).toBe(true);
  });

  it('fails when username is empty', () => {
    const result = loginSchema.safeParse({
      username: '',
      password: 'password',
    });
    expect(result.success).toBe(false);
  });

  it('fails when password is empty', () => {
    const result = loginSchema.safeParse({
      username: 'admin',
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('fails when username is too short', () => {
    const result = loginSchema.safeParse({
      username: 'ab',
      password: 'password',
    });
    expect(result.success).toBe(false);
  });

  it('fails when password is too short', () => {
    const result = loginSchema.safeParse({
      username: 'admin',
      password: 'ab',
    });
    expect(result.success).toBe(false);
  });

  it('fails when both fields are missing', () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('trims username', () => {
    const result = loginSchema.safeParse({
      username: '  admin  ',
      password: 'password',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe('admin');
    }
  });
});

describe('settingsSchema', () => {
  it('passes with valid allow_submissions setting', () => {
    const result = settingsSchema.safeParse({
      field: 'allow_submissions',
      value: 1,
    });
    expect(result.success).toBe(true);
  });

  it('passes with valid allow_user_edits setting', () => {
    const result = settingsSchema.safeParse({
      field: 'allow_user_edits',
      value: 0,
    });
    expect(result.success).toBe(true);
  });

  it('passes with valid allow_uploads setting', () => {
    const result = settingsSchema.safeParse({
      field: 'allow_uploads',
      value: 1,
    });
    expect(result.success).toBe(true);
  });

  it('fails with invalid field', () => {
    const result = settingsSchema.safeParse({
      field: 'invalid_field',
      value: 1,
    });
    expect(result.success).toBe(false);
  });

  it('fails when value is not an integer', () => {
    const result = settingsSchema.safeParse({
      field: 'allow_submissions',
      value: 0.5,
    });
    expect(result.success).toBe(false);
  });

  it('fails when value is less than 0', () => {
    const result = settingsSchema.safeParse({
      field: 'allow_submissions',
      value: -1,
    });
    expect(result.success).toBe(false);
  });

  it('fails when value is greater than 1', () => {
    const result = settingsSchema.safeParse({
      field: 'allow_submissions',
      value: 2,
    });
    expect(result.success).toBe(false);
  });

  it('passes with value at boundary 0', () => {
    const result = settingsSchema.safeParse({
      field: 'allow_submissions',
      value: 0,
    });
    expect(result.success).toBe(true);
  });

  it('passes with value at boundary 1', () => {
    const result = settingsSchema.safeParse({
      field: 'allow_submissions',
      value: 1,
    });
    expect(result.success).toBe(true);
  });

  it('fails when field is missing', () => {
    const result = settingsSchema.safeParse({
      value: 1,
    });
    expect(result.success).toBe(false);
  });

  it('fails when value is missing', () => {
    const result = settingsSchema.safeParse({
      field: 'allow_submissions',
    });
    expect(result.success).toBe(false);
  });
});

describe('passwordChangeSchema', () => {
  const validPasswordChange = {
    currentPassword: 'oldPassword1!',
    newPassword: 'NewPassword2@',
  };

  it('passes with valid data', () => {
    const result = passwordChangeSchema.safeParse(validPasswordChange);
    expect(result.success).toBe(true);
  });

  it('fails when currentPassword is empty', () => {
    const result = passwordChangeSchema.safeParse({
      currentPassword: '',
      newPassword: 'NewPassword2@',
    });
    expect(result.success).toBe(false);
  });

  it('fails when newPassword is too short', () => {
    const result = passwordChangeSchema.safeParse({
      currentPassword: 'oldPassword1!',
      newPassword: 'Sh1!',
    });
    expect(result.success).toBe(false);
  });

  it('fails when newPassword lacks uppercase', () => {
    const result = passwordChangeSchema.safeParse({
      currentPassword: 'oldPassword1!',
      newPassword: 'newpassword2@',
    });
    expect(result.success).toBe(false);
  });

  it('fails when newPassword lacks lowercase', () => {
    const result = passwordChangeSchema.safeParse({
      currentPassword: 'oldPassword1!',
      newPassword: 'NEWPASSWORD2@',
    });
    expect(result.success).toBe(false);
  });

  it('fails when newPassword lacks number', () => {
    const result = passwordChangeSchema.safeParse({
      currentPassword: 'oldPassword1!',
      newPassword: 'NewPassword@',
    });
    expect(result.success).toBe(false);
  });

  it('fails when newPassword lacks special character', () => {
    const result = passwordChangeSchema.safeParse({
      currentPassword: 'oldPassword1!',
      newPassword: 'NewPassword2',
    });
    expect(result.success).toBe(false);
  });

  it('fails when both fields are missing', () => {
    const result = passwordChangeSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('fails when newPassword exceeds 100 characters', () => {
    const result = passwordChangeSchema.safeParse({
      currentPassword: 'oldPassword1!',
      newPassword: 'A'.repeat(98) + 'a1!',
    });
    expect(result.success).toBe(false);
  });
});

describe('searchSchema', () => {
  it('passes with valid search query', () => {
    const result = searchSchema.safeParse({ query: 'test search' });
    expect(result.success).toBe(true);
  });

  it('passes with empty query (no min constraint)', () => {
    const result = searchSchema.safeParse({ query: '' });
    expect(result.success).toBe(true);
  });

  it('passes with whitespace-only query', () => {
    const result = searchSchema.safeParse({ query: '   ' });
    expect(result.success).toBe(true);
  });

  it('trims the query', () => {
    const result = searchSchema.safeParse({ query: '  test  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe('test');
    }
  });

  it('fails when query exceeds 200 characters', () => {
    const result = searchSchema.safeParse({ query: 'a'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('passes with query at exactly 200 characters', () => {
    const result = searchSchema.safeParse({ query: 'a'.repeat(200) });
    expect(result.success).toBe(true);
  });

  it('fails when query is not a string', () => {
    const result = searchSchema.safeParse({ query: 123 });
    expect(result.success).toBe(false);
  });
});

describe('idSchema', () => {
  it('passes with valid positive integer', () => {
    const result = idSchema.safeParse({ id: 1 });
    expect(result.success).toBe(true);
  });

  it('passes with large positive integer', () => {
    const result = idSchema.safeParse({ id: 999999 });
    expect(result.success).toBe(true);
  });

  it('fails when id is zero', () => {
    const result = idSchema.safeParse({ id: 0 });
    expect(result.success).toBe(false);
  });

  it('fails when id is negative', () => {
    const result = idSchema.safeParse({ id: -1 });
    expect(result.success).toBe(false);
  });

  it('fails when id is a float', () => {
    const result = idSchema.safeParse({ id: 1.5 });
    expect(result.success).toBe(false);
  });

  it('fails when id is a string', () => {
    const result = idSchema.safeParse({ id: 'abc' });
    expect(result.success).toBe(false);
  });

  it('fails when id is missing', () => {
    const result = idSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('fails when id is null', () => {
    const result = idSchema.safeParse({ id: null });
    expect(result.success).toBe(false);
  });
});
