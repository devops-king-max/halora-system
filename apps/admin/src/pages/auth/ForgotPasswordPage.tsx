import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Form, Input, Button, Card, Typography, Alert } from "antd";
import { MailOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { apiClient } from "../../api";
import { ApiClientError } from "@halora/api-client";

const { Title, Text } = Typography;

export const ForgotPasswordPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (values: { email: string }) => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await apiClient.auth.staffForgotPassword(values.email);
      setSuccessMessage(res.message || "Yêu cầu khôi phục mật khẩu đã được gửi đến email của bạn.");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message || "Không thể gửi yêu cầu đặt lại mật khẩu.");
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
            Quên mật khẩu
          </Title>
          <Text type="secondary">Nhập email tài khoản nhân viên để nhận mã khôi phục</Text>
        </div>

        {successMessage && (
          <Alert
            type="success"
            message={successMessage}
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

        <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item
            name="email"
            label="Email nhân viên"
            rules={[
              { required: true, message: "Vui lòng nhập email" },
              { type: "email", message: "Email không hợp lệ" },
            ]}
          >
            <Input
              prefix={<MailOutlined style={{ color: "#8c8c8c" }} />}
              placeholder="nhanvien@halora.vn"
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
              style={{
                backgroundColor: "#c05c74",
                borderColor: "#c05c74",
                height: 44,
                fontWeight: 600,
              }}
            >
              Gửi liên kết khôi phục
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
