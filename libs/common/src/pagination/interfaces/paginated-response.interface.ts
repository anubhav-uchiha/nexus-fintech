export interface PaginationResponse<T> {
  data: T[];

  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
  };
}
