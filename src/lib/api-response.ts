/**
 * Standardized API response utilities for consistent error and success responses
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from './logger';

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

/**
 * Standard success response format
 */
export interface SuccessResponse<T = unknown> {
  data?: T;
  message?: string;
}

/**
 * Create a standardized error response
 */
export function errorResponse(
  message: string,
  status: number,
  code?: string,
  details?: unknown
): NextResponse<ErrorResponse> {
  const response: ErrorResponse = {
    error: message,
  };

  if (code) {
    response.code = code;
  }

  if (details) {
    response.details = details;
  }

  logger.error('API Error', undefined, { status, code, message });

  return NextResponse.json(response, { status });
}

/**
 * Create a standardized success response
 */
export function successResponse<T>(
  data?: T,
  message?: string,
  status: number = 200
): NextResponse<SuccessResponse<T>> {
  const response: SuccessResponse<T> = {};

  if (data !== undefined) {
    response.data = data;
  }

  if (message) {
    response.message = message;
  }

  return NextResponse.json(response, { status });
}

/**
 * Handle authentication errors
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse<ErrorResponse> {
  return errorResponse(message, 401, 'UNAUTHORIZED');
}

/**
 * Handle forbidden errors
 */
export function forbiddenResponse(message: string = 'Forbidden'): NextResponse<ErrorResponse> {
  return errorResponse(message, 403, 'FORBIDDEN');
}

/**
 * Handle not found errors
 */
export function notFoundResponse(resource: string = 'Resource'): NextResponse<ErrorResponse> {
  return errorResponse(`${resource} not found`, 404, 'NOT_FOUND');
}

/**
 * Handle validation errors (Zod)
 */
export function validationErrorResponse(error: ZodError): NextResponse<ErrorResponse> {
  const details = error.errors.map(err => ({
    path: err.path.join('.'),
    message: err.message,
  }));

  return errorResponse(
    'Validation failed',
    400,
    'VALIDATION_ERROR',
    details
  );
}

/**
 * Handle Prisma errors
 */
export function prismaErrorResponse(error: unknown): NextResponse<ErrorResponse> {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Handle specific Prisma error codes
    switch (error.code) {
      case 'P2002':
        return errorResponse(
          'A record with this value already exists',
          409,
          'DUPLICATE_ENTRY',
          { field: error.meta?.target }
        );
      case 'P2025':
        return errorResponse(
          'Record not found',
          404,
          'NOT_FOUND'
        );
      case 'P2003':
        return errorResponse(
          'Foreign key constraint failed',
          400,
          'FOREIGN_KEY_ERROR'
        );
      default:
        logger.error('Prisma error', error);
        return errorResponse(
          'Database error occurred',
          500,
          'DATABASE_ERROR'
        );
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return errorResponse(
      'Invalid data provided',
      400,
      'VALIDATION_ERROR'
    );
  }

  return internalErrorResponse();
}

/**
 * Handle generic server errors
 */
export function internalErrorResponse(
  message: string = 'Internal server error'
): NextResponse<ErrorResponse> {
  return errorResponse(message, 500, 'INTERNAL_ERROR');
}

/**
 * Handle method not allowed errors
 */
export function methodNotAllowedResponse(allowed: string[]): NextResponse<ErrorResponse> {
  return NextResponse.json(
    { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
    {
      status: 405,
      headers: {
        Allow: allowed.join(', '),
      },
    }
  );
}

/**
 * Centralized error handler for API routes
 * Use this in catch blocks to handle all error types consistently
 */
export function handleApiError(error: unknown): NextResponse<ErrorResponse> {
  // Zod validation error
  if (error instanceof ZodError) {
    return validationErrorResponse(error);
  }

  // Prisma errors
  if (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientValidationError
  ) {
    return prismaErrorResponse(error);
  }

  // Standard Error with message
  if (error instanceof Error) {
    logger.error('API Error', error);
    return internalErrorResponse(error.message);
  }

  // Unknown error
  logger.error('Unknown API Error', error);
  return internalErrorResponse();
}
