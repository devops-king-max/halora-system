// Formatting utilities for Halora mobile app

export function formatVnd(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "0 đ";
  const num = typeof amount === "string" ? parseInt(amount, 10) : amount;
  if (isNaN(num)) return "0 đ";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(num);
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
  PACKING: "Đang đóng gói",
  HANDED_OVER: "Đã bàn giao",
  DELIVERING: "Đang giao",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING_CONFIRMATION: "#faad14",
  CONFIRMED: "#1677ff",
  PACKING: "#722ed1",
  HANDED_OVER: "#13c2c2",
  DELIVERING: "#2f54eb",
  COMPLETED: "#52c41a",
  CANCELLED: "#f5222d",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  REFUNDED: "Đã hoàn tiền",
  FAILED: "Thất bại",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  COD: "Thanh toán khi nhận hàng (COD)",
  BANK_TRANSFER: "Chuyển khoản ngân hàng",
};
