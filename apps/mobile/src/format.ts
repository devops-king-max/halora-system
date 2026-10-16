// Formatting utilities for Halora mobile app

export function formatVnd(amount: string | number | bigint | null | undefined): string {
  if (amount === null || amount === undefined || !/^-?\d+$/.test(String(amount))) return "—";
  return BigInt(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "\u00a0₫";
}

export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return isoString;
  }
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_CONFIRMATION: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING_CONFIRMATION: "#faad14",
  CONFIRMED: "#1677ff",
  SHIPPING: "#2f54eb",
  COMPLETED: "#52c41a",
  CANCELLED: "#f5222d",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Chờ thanh toán",
  SUCCEEDED: "Thành công",
  CANCELLED: "Đã hủy",
  FAILED: "Thất bại",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  COD: "Thanh toán khi nhận hàng (COD)",
  BANK_TRANSFER: "Chuyển khoản ngân hàng",
};
