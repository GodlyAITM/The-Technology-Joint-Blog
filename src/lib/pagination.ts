export interface PaginationResult<T> {
    items: T[];
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasPrevious: boolean;
    hasNext: boolean;
    previousPage: number | null;
    nextPage: number | null;
}

export function paginate<T>(
    items: T[],
    page = 1,
    pageSize = 10,
): PaginationResult<T> {

    const totalItems = items.length;

    const totalPages = Math.max(
        1,
        Math.ceil(totalItems / pageSize),
    );

    const currentPage = Math.min(
        Math.max(page, 1),
        totalPages,
    );

    const start = (currentPage - 1) * pageSize;

    const end = start + pageSize;

    return {

        items: items.slice(start, end),

        currentPage,

        totalPages,

        totalItems,

        hasPrevious: currentPage > 1,

        hasNext: currentPage < totalPages,

        previousPage:
            currentPage > 1
                ? currentPage - 1
                : null,

        nextPage:
            currentPage < totalPages
                ? currentPage + 1
                : null,

    };

}