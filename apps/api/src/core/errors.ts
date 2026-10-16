export class AppError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly fieldErrors?: Record<string, string[]>) { super(message); }
}
export function fail(code: string, message: string, status = 409): never { throw new AppError(status, code, message); }
export function assert(condition: unknown, code: string, message: string, status = 409): asserts condition { if (!condition) fail(code, message, status); }
export function version(row: Record<string, unknown>, expected: unknown): void {
  assert(Number.isInteger(expected) && row.version === expected, 'VERSION_CONFLICT', 'Dữ liệu đã thay đổi. Vui lòng tải lại.');
}
export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const pg = error as { code?: string; constraint?: string };
  if(pg.code==='LIMIT_FILE_SIZE')return new AppError(413,'VALIDATION_ERROR','Ảnh vượt giới hạn 8 MB.');
  if(pg.code?.startsWith('LIMIT_'))return new AppError(400,'VALIDATION_ERROR','Yêu cầu upload không hợp lệ.');
  if (pg.code === '23503' || pg.code === '23001') return new AppError(409, 'RESOURCE_IN_USE', 'Dữ liệu đang được tham chiếu hoặc liên kết không hợp lệ.');
  if (pg.code === '23505') return new AppError(409, 'VALIDATION_ERROR', 'Dữ liệu bị trùng. Vui lòng kiểm tra mã, tên hoặc thông tin đăng nhập.');
  if (['23514','23502','22003','22P02','22007','22008'].includes(pg.code || '')) return new AppError(400, 'VALIDATION_ERROR', 'Giá trị nhập không hợp lệ.');
  if (['40P01','40001','55P03','57014'].includes(pg.code || '')) return new AppError(409, 'VERSION_CONFLICT', 'Dữ liệu đang được xử lý. Vui lòng thử lại.');
  return new AppError(500, 'INTERNAL_ERROR', 'Không thể xử lý yêu cầu. Vui lòng cung cấp mã yêu cầu cho quản trị viên.');
}
