/**
 * Input Sanitization Middleware Unit Tests
 * Tests for input cleaning and security validation
 */

const {
  sanitizeInput,
  sanitizeString,
  sanitizeObject,
  isValidEmail,
  isValidObjectId,
  escapeHtml
} = require('../../../src/middleware/validation/sanitizeInput');

describe('Input Sanitization', () => {
  describe('sanitizeString', () => {
    test('should remove null bytes', () => {
      expect(sanitizeString('test\x00string')).toBe('teststring');
    });

    test('should remove carriage returns and line feeds', () => {
      expect(sanitizeString('test\r\nstring')).toBe('teststring');
    });

    test('should trim whitespace', () => {
      expect(sanitizeString('  test string  ')).toBe('test string');
    });

    test('should limit length to prevent buffer overflow', () => {
      const longString = 'a'.repeat(10001);
      expect(sanitizeString(longString)).toHaveLength(10000);
    });

    test('should handle non-string inputs', () => {
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
      expect(sanitizeString(123)).toBe('');
    });
  });

  describe('sanitizeObject', () => {
    test('should sanitize object properties recursively', () => {
      const input = {
        name: '  test\x00name  ',
        nested: {
          email: 'test@example.com\r\n',
          data: ['item1\x00', 'item2']
        }
      };

      const result = sanitizeObject(input);

      expect(result.name).toBe('testname');
      expect(result.nested.email).toBe('test@example.com');
      expect(result.nested.data).toEqual(['item1', 'item2']);
    });

    test('should handle arrays', () => {
      const input = ['  item1\x00  ', 'item2\r\n'];
      const result = sanitizeObject(input);

      expect(result).toEqual(['item1', 'item2']);
    });

    test('should prevent infinite recursion', () => {
      const input = { self: null };
      input.self = input; // Circular reference

      const result = sanitizeObject(input, 15); // Beyond max depth
      expect(result).toEqual(input);
    });
  });

  describe('isValidEmail', () => {
    test('should validate correct email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
    });

    test('should reject invalid email formats', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('isValidObjectId', () => {
    test('should validate correct MongoDB ObjectId format', () => {
      expect(isValidObjectId('507f1f77bcf86cd799439011')).toBe(true);
      expect(isValidObjectId('507f1f77bcf86cd799439011'.toUpperCase())).toBe(true);
    });

    test('should reject invalid ObjectId formats', () => {
      expect(isValidObjectId('invalid')).toBe(false);
      expect(isValidObjectId('507f1f77bcf86cd79943901')).toBe(false); // Too short
      expect(isValidObjectId('507f1f77bcf86cd7994390111')).toBe(false); // Too long
      expect(isValidObjectId('gggggggggggggggggggggggg')).toBe(false); // Invalid chars
    });
  });

  describe('escapeHtml', () => {
    test('should escape HTML characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe('<script>alert("xss")<&#x2F;script>');
      expect(escapeHtml('Tom & Jerry')).toBe('Tom & Jerry');
      expect(escapeHtml('"quotes"')).toBe('"quotes"');
    });
  });

  describe('sanitizeInput middleware', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
      mockReq = {
        query: { search: '  test\x00query  ' },
        params: { id: '123\r\n' },
        body: { name: 'test\x00body' }
      };
      mockRes = {};
      mockNext = jest.fn();
    });

    test('should sanitize all input sources', () => {
      sanitizeInput(mockReq, mockRes, mockNext);

      expect(mockReq.query.search).toBe('testquery');
      expect(mockReq.params.id).toBe('123');
      expect(mockReq.body.name).toBe('testbody');
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle missing input sources gracefully', () => {
      const minimalReq = {};
      sanitizeInput(minimalReq, mockRes, mockNext);

      expect(minimalReq.query).toBeUndefined();
      expect(minimalReq.params).toBeUndefined();
      expect(minimalReq.body).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
