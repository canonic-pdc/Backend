export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any;
  timestamp: string;
}

export class ResponseFormatter {
  public static success<T>(data: T, message?: string): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  public static error(message: string, errors?: any): ApiResponse<null> {
    return {
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString(),
    };
  }
}
