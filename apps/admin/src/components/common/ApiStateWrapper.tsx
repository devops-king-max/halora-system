import React from "react";
import { Alert, Button, Empty, Result, Spin } from "antd";
import { ReloadOutlined, DisconnectOutlined } from "@ant-design/icons";
import { ApiClientError } from "@halora/api-client";

interface ApiStateWrapperProps {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  isEmpty?: boolean;
  emptyDescription?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}

export const ApiStateWrapper: React.FC<ApiStateWrapperProps> = ({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyDescription = "Chưa có dữ liệu",
  onRetry,
  children,
}) => {
  if (isLoading) {
    return (
      <div style={{ padding: "48px 0", textAlign: "center" }}>
        <Spin size="large" tip="Đang tải dữ liệu từ máy chủ..." />
      </div>
    );
  }

  if (isError) {
    let errorCode = "UNKNOWN_ERROR";
    let errorMessage = "Không thể tải dữ liệu từ máy chủ.";

    if (error instanceof ApiClientError) {
      errorCode = error.code;
      errorMessage = error.message;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    const isNetwork = errorCode === "NETWORK_ERROR";
    const isForbidden = errorCode === "FORBIDDEN" || (error instanceof ApiClientError && error.status === 403);

    if (isForbidden) {
      return (
        <Result
          status="403"
          title="Không có quyền truy cập"
          subTitle="Tài khoản của bạn không có quyền thực hiện hoặc xem nội dung này."
        />
      );
    }

    return (
      <div style={{ margin: "24px 0" }}>
        <Result
          status="warning"
          icon={<DisconnectOutlined style={{ color: "#c05c74" }} />}
          title={isNetwork ? "Không kết nối được API máy chủ" : `Lỗi hệ thống (${errorCode})`}
          subTitle={
            <div>
              <p>{errorMessage}</p>
              <p style={{ color: "#8c8c8c", fontSize: "13px" }}>
                Backend và cơ sở dữ liệu có thể chưa được khởi động hoặc endpoint chưa sẵn sàng.
              </p>
            </div>
          }
          extra={
            onRetry && (
              <Button type="primary" icon={<ReloadOutlined />} onClick={onRetry} style={{ background: "#c05c74" }}>
                Thử lại kết nối
              </Button>
            )
          }
        />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div style={{ padding: "48px 0" }}>
        <Empty description={emptyDescription} />
      </div>
    );
  }

  return <>{children}</>;
};
