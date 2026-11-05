import React, { useState } from "react";
import {
  Typography,
  Descriptions,
  Button,
  Card,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  message,
  Radio,
  Divider,
} from "antd";
import {
  ArrowLeftOutlined,
  UserAddOutlined,
  SafetyCertificateOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../api";
import { ApiStateWrapper } from "../../components/common/ApiStateWrapper";
import { StatusBadge } from "../../components/common/StatusBadge";
import { PermissionGuard } from "../../components/common/PermissionGuard";
import { formatDateTime } from "../../utils/format";
import { ApiClientError } from "@halora/api-client";
import type { EmployeeAccountInput } from "@halora/api-client";

const { Title, Text } = Typography;

export const EmployeeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [accountForm] = Form.useForm();
  const [rolesForm] = Form.useForm();

  // 1. Fetch Employee
  const {
    data: employee,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin", "employees", id],
    queryFn: () => apiClient.employees.getAdmin(id!),
    enabled: !!id,
  });

  // 2. Fetch all system roles
  const { data: rolesList } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: () => apiClient.roles.listAdmin(),
  });

  // Create User Account Mutation
  const createAccountMutation = useMutation({
    mutationFn: (values: EmployeeAccountInput) => apiClient.employees.createAccount(id!, values),
    onSuccess: () => {
      message.success("Tạo tài khoản đăng nhập cho nhân viên thành công!");
      setAccountModalOpen(false);
      accountForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "employees", id] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message || `Lỗi: ${err.code}`);
      } else {
        message.error("Lỗi khi tạo tài khoản.");
      }
    },
  });

  // Assign Roles Mutation
  const assignRolesMutation = useMutation({
    mutationFn: (roleIds: string[]) =>
      apiClient.employees.assignRoles(id!, {
        roleIds,
        version: employee!.version,
      }),
    onSuccess: () => {
      message.success("Cập nhật vai trò nhân viên thành công!");
      setRolesModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "employees", id] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        if (err.code === "VERSION_CONFLICT") {
          message.error("Dữ liệu nhân viên đã bị thay đổi bởi người khác. Vui lòng tải lại.");
        } else {
          message.error(err.message || `Lỗi: ${err.code}`);
        }
      } else {
        message.error("Lỗi khi phân vai trò.");
      }
    },
  });

  const openAccountModal = () => {
    if (!employee) return;
    accountForm.setFieldsValue({
      email: employee.email,
      username: employee.email.split("@")[0],
    });
    setAccountModalOpen(true);
  };

  const openRolesModal = () => {
    if (!employee) return;
    rolesForm.setFieldsValue({
      roleIds: (employee.roleIds || []).slice(0, 1)[0],
    });
    setRolesModalOpen(true);
  };

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/employees")}>
            Danh sách nhân viên
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            Hồ sơ nhân viên: {employee?.fullName || "Đang tải..."}
          </Title>
        </div>

        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Làm mới
          </Button>

          {employee && !employee.accountId && (
            <PermissionGuard permission="employees.createAccount">
              <Button
                type="primary"
                icon={<UserAddOutlined />}
                onClick={openAccountModal}
                style={{ backgroundColor: "#c05c74", borderColor: "#c05c74" }}
              >
                Cấp tài khoản đăng nhập
              </Button>
            </PermissionGuard>
          )}

          <PermissionGuard permission="employees.assignRoles">
            <Button icon={<SafetyCertificateOutlined />} onClick={openRolesModal}>
              Phân vai trò
            </Button>
          </PermissionGuard>
        </Space>
      </div>

      <ApiStateWrapper isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
        {employee && (
          <Card bordered={false} style={{ background: "#fafafa" }}>
            <Descriptions title="Thông tin nhân sự" bordered size="middle" column={{ xs: 1, sm: 2, md: 3 }}>
              <Descriptions.Item label="Mã nhân viên">
                <code>{employee.code}</code>
              </Descriptions.Item>
              <Descriptions.Item label="Họ và tên">
                <Text strong>{employee.fullName}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Vị trí / Chức vụ">
                {employee.position}
              </Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">
                {employee.phone}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {employee.email}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái làm việc">
                <StatusBadge type="active" status={employee.status} />
              </Descriptions.Item>
              <Descriptions.Item label="Tài khoản đăng nhập">
                {employee.accountId ? (
                  <Space>
                    <Tag color="green">Đã liên kết tài khoản</Tag>
                  </Space>
                ) : (
                  <Tag color="orange">Chưa có tài khoản</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày gia nhập">
                {formatDateTime(employee.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Cập nhật lần cuối">
                {formatDateTime(employee.updatedAt)}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">Vai trò trong hệ thống</Divider>
            <div>
              {employee.roleIds && employee.roleIds.length > 0 ? (
                <Space wrap>
                  {employee.roleIds.map((rid) => {
                    const r = rolesList?.find((role) => role.id === rid);
                    return (
                      <Tag color="magenta" key={rid} style={{ fontSize: 13, padding: "4px 10px" }}>
                        {r ? `${r.name} (${r.code})` : rid}
                      </Tag>
                    );
                  })}
                </Space>
              ) : (
                <Text type="secondary">Nhân viên này chưa được gán vai trò nào.</Text>
              )}
            </div>
          </Card>
        )}
      </ApiStateWrapper>

      {/* Modal Create Account */}
      <Modal
        title="Cấp tài khoản đăng nhập hệ thống"
        open={accountModalOpen}
        onCancel={() => setAccountModalOpen(false)}
        onOk={() => accountForm.submit()}
        confirmLoading={createAccountMutation.isPending}
        okText="Tạo tài khoản"
        cancelText="Hủy"
        okButtonProps={{ style: { backgroundColor: "#c05c74", borderColor: "#c05c74" } }}
      >
        <Form form={accountForm} layout="vertical" onFinish={(vals) => createAccountMutation.mutate(vals)}>
          <Form.Item
            name="username"
            label="Tên đăng nhập"
            rules={[{ required: true, message: "Vui lòng nhập tên đăng nhập" }]}
          >
            <Input placeholder="username" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email tài khoản"
            rules={[
              { required: true, message: "Vui lòng nhập email" },
              { type: "email", message: "Email không hợp lệ" },
            ]}
          >
            <Input placeholder="email@halora.vn" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Mật khẩu khởi tạo"
            rules={[
              { required: true, message: "Vui lòng nhập mật khẩu" },
              { min: 10, max: 128, message: "Mật khẩu từ 10 đến 128 ký tự" },
            ]}
          >
            <Input.Password placeholder="••••••••" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Assign Roles */}
      <Modal
        title="Phân vai trò nhân viên"
        open={rolesModalOpen}
        onCancel={() => setRolesModalOpen(false)}
        onOk={() => rolesForm.submit()}
        confirmLoading={assignRolesMutation.isPending}
        okText="Lưu vai trò"
        cancelText="Hủy"
        okButtonProps={{ style: { backgroundColor: "#c05c74", borderColor: "#c05c74" } }}
      >
        <Form
          form={rolesForm}
          layout="vertical"
          onFinish={(vals: { roleIds?: string }) => assignRolesMutation.mutate(vals.roleIds ? [vals.roleIds] : [])}
        >
          <Form.Item name="roleIds" label="Chọn một vai trò">
            <Radio.Group style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
              {rolesList?.filter(r => r.code !== 'CUSTOMER').map((r) => (
                <Radio key={r.id} value={r.id}>
                  <Text strong>{r.name}</Text> (<code>{r.code}</code>) - {r.description}
                </Radio>
              ))}
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
