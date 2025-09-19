/**
 * Error Utilities Unit Tests
 * Tests for error handling and formatting utilities
 */

const {
  createErrorResponse,
  createValidationErrorResponse,
  createNotFoundResponse,
  createDatabaseErrorResponse
} = require('../../../src/utils/errors/errorResponseFormatter');

const ERROR_TYPES = require('../../../src/utils/errors/errorTypes');
const HTTP_STATUS = require('../../../src/utils/errors/httpStatusCodes');

describe('Error Response Formatter', () => {
  const mockRequestId = 'test-request-123';

  describe('createErrorResponse', () => {
    test('should create basic error response', () => {
      const response = createErrorResponse(
        ERROR_TYPES.INTERNAL_SERVER_ERROR,
        'Something went wrong',
        null,
        mockRequestId
      );

      expect(response).toEqual({
        success: false,
        error: {
          code: ERROR_TYPES.INTERNAL_SERVER_ERROR,
          message: 'Something went wrong',
          timestamp: expect.any(String),
          requestId: mockRequestId
        }
      });
    });

    test('should include details when provided', () => {
      const details = { field: 'email', reason: 'Invalid format' };
      const response = createErrorResponse(
        ERROR_TYPES.VALIDATION_ERROR,
        'Validation failed',
        details,
        mockRequestId
      );

      expect(response.error.details).toEqual(details);
    });

    test('should generate timestamp', () => {
      const before = new Date();
      const response = createErrorResponse(ERROR_TYPES.INTERNAL_SERVER_ERROR);
      const after = new Date();

      expect(response.error.timestamp).toBeDefined();
      const timestamp = new Date(response.error.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('createValidationErrorResponse', () => {
    test('should format validation errors correctly', () => {
      const validationErrors = [
        { field: 'email', message: 'Invalid format', value: 'invalid-email' },
        { field: 'password', message: 'Too short', value: '123' }
      ];

      const response = createValidationErrorResponse(validationErrors, mockRequestId);

      expect(response.success).toBe(false);
      expect(response.error.code).toBe(ERROR_TYPES.VALIDATION_ERROR);
      expect(response.error.details.fields).toEqual([
        { field: 'email', message: 'Invalid format', value: 'invalid-email' },
        { field: 'password', message: 'Too short', value: '123' }
      ]);
    });
  });

  describe('createNotFoundResponse', () => {
    test('should create not found response', () => {
      const response = createNotFoundResponse('User', mockRequestId);

      expect(response.success).toBe(false);
      expect(response.error.code).toBe(ERROR_TYPES.NOT_FOUND);
      expect(response.error.message).toBe('User not found');
      expect(response.error.details.resource).toBe('User');
    });
  });

  describe('createDatabaseErrorResponse', () => {
    test('should hide internal errors in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const mockError = new Error('Database connection failed');
      const response = createDatabaseErrorResponse(mockError, mockRequestId);

      expect(response.error.message).toBe('Database operation failed');
      expect(response.error.details).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    test('should show internal errors in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const mockError = new Error('Database connection failed');
      const response = createDatabaseErrorResponse(mockError, mockRequestId);

      expect(response.error.details.originalError).toBe('Database connection failed');

      process.env.NODE_ENV = originalEnv;
    });
  });
});
