import React, { useState } from "react";
import {
  Typography,
  Table,
  Button,
  Card,
  Space,
  Modal,
  Form,
  Checkbox,
  Tag,
  message,
  Tooltip,
  Divider,
} from "antd";
import {
  SafetyCertificateOutlined,
  EditOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../api";
import { ApiStateWrapper } from "../../components/common/ApiStateWrapper";
import { PermissionGuard } from "../../components/common/PermissionGuard";
import { formatDateTime } from "../../utils/format";
import { ApiClientError } from "@halora/api-client";
import type { Role, Permission } from "@halora/api-client";

const { Title, Text } = Typography;

export const RolesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form] = Form.useForm();

  // 1. Fetch Roles
  const {
    data: roles,
    isLoading: rolesLoading,
    isError: rolesError,
    error: rError,
    refetch: refetchRoles,
  } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: () => apiClient.roles.listAdmin(),
  });

  // 2. Fetch Permissions
  const { data: permissions } = useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: () => apiClient.roles.listPermissionsAdmin(),
  });

  const assignPermissionsMutation = useMutation({
    mutationFn: ({ roleId, permissionIds, version }: { roleId: string; permissionIds: string[]; version: number }) =>
      apiClient.roles.assignPermissions(roleId, { permissionIds, version }),
    onSuccess: () => {
      message.success("Cập nhật quyền cho vai trò thành công!");
      setModalOpen(false);
      setEditingRole(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        if (err.code === "VERSION_CONFLICT") {
          message.error("Dữ liệu vai trò đã bị thay đổi bởi người khác. Vui lòng tải lại.");
        } else {
          message.error(err.message || `Lỗi: ${err.code}`);
        }
      } else {
        message.error("Lỗi khi phân quyền vai trò.");
      }
    },
  });

  const openPermissionModal = (role: Role) => {
    setEditingRole(role);
    form.setFieldsValue({
      permissionIds: role.permissionIds || [],
    });
    setModalOpen(true);
  };

  // Group permissions by prefix resource (e.g., categories, products, orders)
  const groupedPermissions = React.useMemo(() => {
    if (!permissions) return {};
    const groups: Record<string, Permission[]> = {};
    for (const p of permissions) {
      const resource = p.code.split(".")[0] || "Khác";
      if (!groups[resource]) {
        groups[resource] = [];
      }
      groups[resource].push(p);
    }
    return groups;
  }, [permissions]);

  const columns = [
    {
      title: "Mã vai trò",
      dataIndex: "code",
      key: "code",
      width: 160,
      render: (code: string) => <Tag color="magenta">{code}</Tag>,
    },
    {
      title: "Tên vai trò",
      dataIndex: "name",
      key: "name",
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: "Mô tả",
      dataIndex: "description",
      key: "description",
    },
    {
      title: "Số quyền đã cấp",
      dataIndex: "permissionIds",
      key: "permissionIds",
      width: 160,
      render: (pIds: string[]) => <Tag color="blue">{pIds?.length || 0} quyền</Tag>,
    },
    {
      title: "Cập nhật lần cuối",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 170,
      render: (d: string) => formatDateTime(d),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 130,
      render: (_: unknown, record: Role) => (
        <PermissionGuard permission="roles.update">
          <Button
            type="primary"
            ghost
            size="small"
            icon={<EditOutlined />}
            onClick={() => openPermissionModal(record)}
          >
            Phân quyền
          </Button>
        </PermissionGuard>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Vai trò & Phân quyền
          </Title>
          <Text type="secondary">Quản trị các vai trò trong hệ thống và danh sách quyền hạn được gán</Text>
        </div>

        <Button icon={<ReloadOutlined />} onClick={() => refetchRoles()}>
          Làm mới
        </Button>
      </div>

      <ApiStateWrapper
        isLoading={rolesLoading}
        isError={rolesError}
        error={rError}
        isEmpty={!roles || roles.length === 0}
        emptyDescription="Chưa có vai trò nào được cấu hình"
        onRetry={() => refetchRoles()}
      >
        {roles && (
          <Table dataSource={roles} columns={columns} rowKey="id" pagination={false} />
        )}
      </ApiStateWrapper>

      {/* Modal Configure Permissions */}
      <Modal
        title={`Phân quyền cho vai trò: ${editingRole?.name} (${editingRole?.code})`}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingRole(null);
        }}
        onOk={() => form.submit()}
        confirmLoading={assignPermissionsMutation.isPending}
        okText="Lưu danh sách quyền"
        cancelText="Hủy"
        width={760}
        okButtonProps={{ style: { backgroundColor: "#c05c74", borderColor: "#c05c74" } }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(vals: { permissionIds: string[] }) => {
            if (editingRole) {
              assignPermissionsMutation.mutate({
                roleId: editingRole.id,
                permissionIds: vals.permissionIds,
                version: editingRole.version,
              });
            }
          }}
        >
          <Form.Item name="permissionIds" valuePropName="value">
            <Checkbox.Group style={{ width: "100%" }}>
              <div style={{ maxHeight: 450, overflowY: "auto", paddingRight: 8 }}>
                {Object.entries(groupedPermissions).map(([resource, perms]) => (
                  <div key={resource} style={{ marginBottom: 16 }}>
                    <Divider orientation="left" plain style={{ margin: "10px 0" }}>
                      <Text strong style={{ textTransform: "uppercase", color: "#c05c74" }}>
                        Nhóm: {resource}
                      </Text>
                    </Divider>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {perms.map((p) => (
                        <Checkbox key={p.id} value={p.id}>
                          <Text strong>{p.name}</Text>
                          <div style={{ fontSize: 12, color: "#8c8c8c" }}>{p.code}</div>
                        </Checkbox>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
