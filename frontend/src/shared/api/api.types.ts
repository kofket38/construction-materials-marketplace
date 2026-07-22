export interface ApiSuccessResponse<TData> {
  success: true;
  data: TData;
}

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors: ApiFieldError[];
}
