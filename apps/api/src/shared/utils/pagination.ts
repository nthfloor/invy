export interface PaginationMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export function createPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  perPage: number,
): PaginatedResult<T> {
  return {
    data,
    meta: {
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    },
  };
}

export function getPaginationParams(
  page?: number,
  perPage?: number,
): { skip: number; take: number; page: number; perPage: number } {
  const currentPage = Math.max(1, page || 1);
  const itemsPerPage = Math.min(100, Math.max(1, perPage || 20));

  return {
    skip: (currentPage - 1) * itemsPerPage,
    take: itemsPerPage,
    page: currentPage,
    perPage: itemsPerPage,
  };
}
