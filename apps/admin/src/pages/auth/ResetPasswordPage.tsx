import React, { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Form, Input, Button, Card, Typography, Alert } from "antd";
import { LockOutlined, KeyOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { apiClient } from "../../api";
import { ApiClientError } from "@halora/api-client";

const { Title, Text } = Typography;

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (values: { token: string; newPassword: string }) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await apiClient.auth.staffResetPassword(values.token, values.newPassword);
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message || "Không thể đặt lại mật khẩu. Token có thể đã hết hạn.");
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Lỗi kết nối đến máy chủ.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #fceef1 0%, #f7f8fa 100%)",
        padding: "20px",
      }}
    >
      <Card
        style={{
          width: 420,
          boxShadow: "0 8px 24px rgba(192, 92, 116, 0.12)",
          borderRadius: 12,
          border: "1px solid #f3d2db",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0, color: "#1f1f1f" }}>
            Đặt lại mật khẩu
          </Title>
          <Text type="secondary">Nhập mã xác thực từ email và mật khẩu mới của bạn</Text>
        </div>

        {success && (
          <Alert
            type="success"
            message="Đặt lại mật khẩu thành công! Đang chuyển hướng về trang đăng nhập..."
            showIcon
            style={{ marginBottom: 20 }}
          />
        )}

        {errorMessage && (
          <Alert
            type="error"
            message={errorMessage}
            showIcon
            closable
            onClose={() => setErrorMessage(null)}
            style={{ marginBottom: 20 }}
          />
        )}

        <Form
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ token: tokenFromUrl }}
          requiredMark={false}
        >
          <Form.Item
            name="token"
            label="Mã xác thực token"
            rules={[{ required: true, message: "Vui lòng nhập mã token" }]}
          >
            <Input
              prefix={<KeyOutlined style={{ color: "#8c8c8c" }} />}
              placeholder="Nhập mã token từ email"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="Mật khẩu mới"
            rules={[
              { required: true, message: "Vui lòng nhập mật khẩu mới" },
              { min: 6, message: "Mật khẩu tối thiểu 6 ký tự" },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: "#8c8c8c" }} />}
              placeholder="••••••••"
              size="large"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
              disabled={success}
              style={{
                backgroundColor: "#c05c74",
                borderColor: "#c05c74",
                height: 44,
                fontWeight: 600,
              }}
            >
              Cập nhật mật khẩu mới
            </Button>
          </Form.Item>

          <div style={{ textAlign: "center" }}>
            <Link to="/login" style={{ color: "#595959", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ArrowLeftOutlined /> Quay lại đăng nhập
            </Link>
          </div>
        </Form>
      </Card>
    </div>
  );
};
