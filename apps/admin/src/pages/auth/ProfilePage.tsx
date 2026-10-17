import React, { useEffect, useState } from "react";
import { Card, Typography, Row, Col, Descriptions, Tag, Form, Input, Button, Alert, message } from "antd";
import { UserOutlined, LockOutlined, LogoutOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api";
import { ApiClientError } from "@halora/api-client";
import type { AccountProfileUpdateInput } from "@halora/api-client";
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;

export const ProfilePage: React.FC = () => {
  const { principal, logout, reloadPrincipal } = useAuth();
  const queryClient = useQueryClient();
  const [profileForm] = Form.useForm();
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const { data: profile, isLoading: profileLoading, error: loadError, refetch } = useQuery({
    queryKey: ["auth", "profile", principal?.accountId],
    queryFn: () => apiClient.auth.getProfile(),
    enabled: !!principal,
  });
  useEffect(() => { if (profile) profileForm.setFieldsValue(profile); }, [profile, profileForm]);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSaveProfile = async (values: Omit<AccountProfileUpdateInput, "version">) => {
    if (!profile) return;
    setSavingProfile(true);
    setProfileError(null);
    try {
      const saved = await apiClient.auth.updateProfile({
        fullName: values.fullName.trim(), email: values.email.trim(), phone: values.phone.trim(), version: profile.version,
      });
      queryClient.setQueryData(["auth", "profile", principal?.accountId], saved);
      await reloadPrincipal();
      await queryClient.invalidateQueries({ queryKey: ["admin", "employees"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "accounts"] });
      message.success("Đã cập nhật thông tin cá nhân.");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Không thể cập nhật thông tin cá nhân.");
    } finally { setSavingProfile(false); }
  };

  const handleChangePassword = async (values: { currentPassword: string; newPassword: string }) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.auth.changePassword(values.currentPassword, values.newPassword);
      message.success(res.message || "Đổi mật khẩu thành công!");
      form.resetFields();
      await logout();
      navigate("/login");
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
          <Text type="secondary">Cập nhật thông tin cá nhân và mật khẩu của bạn</Text>
        </div>
        <Button danger icon={<LogoutOutlined />} onClick={handleLogout}>
          Đăng xuất
        </Button>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Card title={<><UserOutlined /> Thông tin cá nhân</>} bordered={false} loading={profileLoading}>
            <Descriptions column={1} bordered size="middle">
              <Descriptions.Item label="Mã tài khoản">
                <code>{principal?.accountCode}</code>
              </Descriptions.Item>
              <Descriptions.Item label="Tên đăng nhập">
                {principal?.username}
              </Descriptions.Item>
              <Descriptions.Item label="Vai trò">
                {principal?.roles?.map((role) => (
                  <Tag color="magenta" key={role}>
                    {role}
                  </Tag>
                ))}
              </Descriptions.Item>
            </Descriptions>

            {(loadError || profileError) && <Alert type="error" showIcon style={{ marginTop: 16 }}
              message={profileError || (loadError instanceof Error ? loadError.message : "Không thể tải thông tin cá nhân.")}
              action={<Button size="small" onClick={() => { setProfileError(null); refetch(); }}>Tải lại</Button>} />}
            {profile && <Form form={profileForm} layout="vertical" onFinish={handleSaveProfile} disabled={savingProfile} style={{ marginTop: 24 }}>
              <Form.Item name="fullName" label="Họ và tên" rules={[{ required: true, whitespace: true, message: "Vui lòng nhập họ và tên" }, { max: 255 }]}>
                <Input autoComplete="name" maxLength={255} />
              </Form.Item>
              <Form.Item name="email" label="Email" rules={[{ required: true, message: "Vui lòng nhập email" }, { type: "email", message: "Email không hợp lệ" }, { max: 254 }]}>
                <Input autoComplete="email" maxLength={254} />
              </Form.Item>
              <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, whitespace: true, message: "Vui lòng nhập số điện thoại" }, { max: 255 }]}>
                <Input autoComplete="tel" maxLength={255} />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={savingProfile}>Lưu thông tin cá nhân</Button>
            </Form>}
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
                  { min: 10, max: 128, message: "Mật khẩu từ 10 đến 128 ký tự" },
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
