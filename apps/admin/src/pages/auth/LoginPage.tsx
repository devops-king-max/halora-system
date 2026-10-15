import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Form, Input, Button, Card, Typography, Alert, Space } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useAuth } from "../../context/AuthContext";
import { ApiClientError } from "@halora/api-client";

const { Title, Text } = Typography;

export const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (values: { identifier: string; password: string }) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await login(values.identifier, values.password);
      navigate("/");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.code === "NETWORK_ERROR") {
          setErrorMessage("Không thể kết nối đến máy chủ API. Vui lòng kiểm tra lại dịch vụ backend.");
        } else if (err.code === "UNAUTHENTICATED" || err.status === 401) {
          setErrorMessage("Tên đăng nhập hoặc mật khẩu không chính xác.");
        } else {
          setErrorMessage(err.message || `Lỗi đăng nhập (${err.code})`);
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Đã xảy ra lỗi không xác định khi đăng nhập.");
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
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "#c05c74",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 24,
              fontWeight: "bold",
              marginBottom: 12,
            }}
          >
            H
          </div>
          <Title level={3} style={{ margin: 0, color: "#1f1f1f" }}>
            Halora Admin
          </Title>
          <Text type="secondary">Đăng nhập tài khoản quản trị và nhân viên</Text>
        </div>

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

        <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item
            name="identifier"
            label="Tên đăng nhập hoặc Email"
            rules={[{ required: true, message: "Vui lòng nhập tên đăng nhập hoặc email" }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: "#8c8c8c" }} />}
              placeholder="admin@halora.vn hoặc username"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Mật khẩu"
            rules={[{ required: true, message: "Vui lòng nhập mật khẩu" }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: "#8c8c8c" }} />}
              placeholder="••••••••"
              size="large"
            />
          </Form.Item>

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
            <Link to="/forgot-password" style={{ color: "#c05c74", fontSize: 13 }}>
              Quên mật khẩu?
            </Link>
          </div>

          <Form.Item style={{ marginBottom: 0 }}>
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
              Đăng nhập hệ thống
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
