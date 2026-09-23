// src/utils/ApiResponse.ts

/**
 * Core contract definition for all API network payloads
 */
interface IApiResponse {
  statusCode: number;
  success: boolean;
  message: string;
}

/**
 * 🟢 Standardized wrapper for successful actions
 */
export class SuccessResponse<T = any> implements IApiResponse {
  statusCode: number;
  success: boolean = true; // Always true
  message: string;
  data: T;

  constructor(statusCode: number, message: string, data: T) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }
}

/**
 * 🔴 Standardized wrapper for error actions
 */
export class ErrorResponse<E = any> implements IApiResponse {
  statusCode: number;
  success: boolean = false; // Always false
  message: string;
  errors: E; // Clean semantic naming for client parsing!
  data: null = null; // Standardized envelope contract (Doc 5 §5.1)

  constructor(statusCode: number, message: string, errors: E) {
    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors;
  }
}