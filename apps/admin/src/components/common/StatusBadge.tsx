import React from "react";
import { Tag } from "antd";

interface StatusBadgeProps {
  type:
    | "active"
    | "order"
    | "payment"
    | "refund"
    | "document"
    | "promotion"
    | "account";
  status: string | null | undefined;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ type, status }) => {
  if (!status) return <span>—</span>;

  let color = "default";
  let label = status;

  switch (type) {
    case "active":
      if (status === "ACTIVE") {
        color = "success";
        label = "Đang hoạt động";
      } else {
        color = "default";
        label = "Ngừng hoạt động";
      }
      break;

    case "order":
      switch (status) {
        case "PENDING_CONFIRMATION":
          color = "warning";
          label = "Chờ xác nhận";
          break;
        case "CONFIRMED":
          color = "processing";
          label = "Đã xác nhận";
          break;
        case "SHIPPING":
          color = "cyan";
          label = "Đang giao hàng";
          break;
        case "COMPLETED":
          color = "success";
          label = "Hoàn tất";
          break;
        case "CANCELLED":
          color = "error";
          label = "Đã hủy";
          break;
      }
      break;

    case "payment":
      switch (status) {
        case "PENDING":
          color = "warning";
          label = "Chờ thanh toán";
          break;
        case "SUCCEEDED":
          color = "success";
          label = "Đã thanh toán";
          break;
        case "FAILED":
          color = "error";
          label = "Thanh toán thất bại";
          break;
        case "CANCELLED":
          color = "default";
          label = "Đã hủy";
          break;
      }
      break;

    case "refund":
      switch (status) {
        case "PENDING":
          color = "warning";
          label = "Chờ hoàn tiền";
          break;
        case "SUCCEEDED":
          color = "success";
          label = "Hoàn tiền thành công";
          break;
        case "FAILED":
          color = "error";
          label = "Hoàn tiền thất bại";
          break;
      }
      break;

    case "document":
      switch (status) {
        case "DRAFT":
          color = "warning";
          label = "Bản nháp";
          break;
        case "POSTED":
          color = "success";
          label = "Đã ghi nhận";
          break;
        case "CANCELLED":
          color = "error";
          label = "Đã hủy";
          break;
      }
      break;

    case "promotion":
      switch (status) {
        case "DRAFT":
          color = "warning";
          label = "Bản nháp";
          break;
        case "ACTIVE":
          color = "success";
          label = "Đang diễn ra";
          break;
        case "PAUSED":
          color = "purple";
          label = "Tạm dừng";
          break;
        case "ENDED":
          color = "default";
          label = "Đã kết thúc";
          break;
      }
      break;

    case "account":
      switch (status) {
        case "ACTIVE":
          color = "success";
          label = "Hoạt động";
          break;
        case "LOCKED":
          color = "error";
          label = "Đã khóa";
          break;
        case "INACTIVE":
          color = "default";
          label = "Ngừng hoạt động";
          break;
      }
      break;
  }

  return <Tag color={color}>{label}</Tag>;
};
