export declare class AppError extends Error {
    readonly status: number;
    readonly errorCode: string;
    readonly details?: Record<string, string[]>;
    constructor(status: number, errorCode: string, message: string, details?: Record<string, string[]>);
}
export declare function createHttpError(status: number, errorCode: string, message: string, details?: Record<string, string[]>): AppError;
//# sourceMappingURL=AppError.d.ts.map