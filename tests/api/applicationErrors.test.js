const { ApplicationError } = require('../../src/core/errors');
const { errorHandler } = require('../../src/api/http/errors');

describe('application error HTTP mapping', () => {
  test.each([
    ['invalid', 400],
    ['not_found', 404],
    ['conflict', 409],
    ['upstream', 502]
  ])('maps %s errors without changing the response contract', (category, status) => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const error = new ApplicationError(category, 'example_error', 'Example message', {
      field: 'example'
    });

    errorHandler(error, { id: 'request-id' }, response);

    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'example_error',
        message: status < 500 ? 'Example message' : 'An unexpected error occurred',
        requestId: 'request-id',
        details: { field: 'example' }
      }
    });
  });
});
