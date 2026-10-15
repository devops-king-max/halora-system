import React, { useState } from "react";
import { Card, Typography, Row, Col, Descriptions, Tag, Form, Input, Button, Alert, message, Divider } from "antd";
import { UserOutlined, LockOutlined, SafetyCertificateOutlined, LogoutOutlined } from "@ant-design/icons";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api";
import { ApiClientError } from "@halora/api-client";
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;

export const ProfilePage: React.FC = () => {
  const { principal, logout } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleChangePassword = async (values: { currentPassword: string; newPassword: string }) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.auth.changePassword(values.currentPassword, values.newPassword);
      message.success(res.message || "Đổi mật khẩu thành công!");
      form.resetFields();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message || "Không thể đổi mật khẩu.");
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Lỗi kết nối máy chủ.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Hồ sơ tài khoản
          </Title>
          <Text type="secondary">Xem thông tin cá nhân, phân quyền và cập nhật mật khẩu</Text>
        </div>
        <Button danger icon={<LogoutOutlined />} onClick={handleLogout}>
          Đăng xuất
        </Button>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Card title={<><UserOutlined /> Thông tin nhân viên</>} bordered={false}>
            <Descriptions column={1} bordered size="middle">
              <Descriptions.Item label="Mã tài khoản (ID)">
                <code>{principal?.accountId}</code>
              </Descriptions.Item>
              <Descriptions.Item label="Tên hiển thị">
                <Text strong>{principal?.displayName || "—"}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Tên đăng nhập">
                {principal?.username}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {principal?.email}
              </Descriptions.Item>
              <Descriptions.Item label="Vai trò">
                {principal?.roles?.map((role) => (
                  <Tag color="magenta" key={role}>
                    {role}
                  </Tag>
                ))}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">
              <SafetyCertificateOutlined /> Quyền hạn được cấp ({principal?.permissions?.length || 0})
            </Divider>
            <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {principal?.permissions?.map((perm) => (
                <Tag key={perm} color="blue">
                  {perm}
                </Tag>
              ))}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title={<><LockOutlined /> Đổi mật khẩu</>} bordered={false}>
            {errorMessage && (
              <Alert
                type="error"
                message={errorMessage}
                showIcon
                closable
                onClose={() => setErrorMessage(null)}
                style={{ marginBottom: 16 }}
              />
            )}

            <Form form={form} layout="vertical" onFinish={handleChangePassword}>
              <Form.Item
                name="currentPassword"
                label="Mật khẩu hiện tại"
                rules={[{ required: true, message: "Vui lòng nhập mật khẩu hiện tại" }]}
              >
                <Input.Password placeholder="••••••••" />
              </Form.Item>

              <Form.Item
                name="newPassword"
                label="Mật khẩu mới"
                rules={[
                  { required: true, message: "Vui lòng nhập mật khẩu mới" },
                  { min: 6, message: "Mật khẩu tối thiểu 6 ký tự" },
                ]}
              >
                <Input.Password placeholder="••••••••" />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label="Xác nhận mật khẩu mới"
                dependencies={["newPassword"]}
                rules={[
                  { required: true, message: "Vui lòng xác nhận mật khẩu mới" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("newPassword") === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error("Mật khẩu xác nhận không khớp!"));
                    },
                  }),
                ]}
              >
                <Input.Password placeholder="••••••••" />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  style={{ backgroundColor: "#c05c74", borderColor: "#c05c74" }}
                >
                  Cập nhật mật khẩu
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
