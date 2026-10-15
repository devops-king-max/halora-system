import React, { useState } from "react";
import {
  Typography,
  Table,
  Button,
  Input,
  Select,
  Space,
  Modal,
  Form,
  message,
  Popconfirm,
  Card,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../api";
import { ApiStateWrapper } from "../../components/common/ApiStateWrapper";
import { StatusBadge } from "../../components/common/StatusBadge";
import { PermissionGuard } from "../../components/common/PermissionGuard";
import { formatDateTime } from "../../utils/format";
import { ApiClientError } from "@halora/api-client";
import type { Employee, EmployeeInput } from "@halora/api-client";

const { Title, Text } = Typography;

export const EmployeesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "employees", page, limit, search, statusFilter],
    queryFn: () =>
      apiClient.employees.listAdmin({
        page,
        limit,
        search: search || undefined,
        status: statusFilter,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
  });

  const createMutation = useMutation({
    mutationFn: (input: EmployeeInput) => apiClient.employees.createAdmin(input),
    onSuccess: (emp) => {
      message.success("Thêm nhân viên thành công!");
      setModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "employees"] });
      navigate(`/employees/${emp.id}`);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message || `Lỗi: ${err.code}`);
      } else {
        message.error("Lỗi khi thêm nhân viên.");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input, version }: { id: string; input: EmployeeInput; version: number }) =>
      apiClient.employees.updateAdmin(id, { ...input, version }),
    onSuccess: () => {
      message.success("Cập nhật thông tin nhân viên thành công!");
      setModalOpen(false);
      setEditingEmployee(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "employees"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        if (err.code === "VERSION_CONFLICT") {
          message.error("Dữ liệu nhân viên đã bị thay đổi bởi người khác. Vui lòng tải lại.");
        } else {
          message.error(err.message || `Lỗi: ${err.code}`);
        }
      } else {
        message.error("Lỗi khi cập nhật nhân viên.");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.employees.deleteAdmin(id),
    onSuccess: () => {
      message.success("Đã xóa nhân viên!");
      queryClient.invalidateQueries({ queryKey: ["admin", "employees"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message || "Không thể xóa nhân viên đã gắn chứng từ hoặc đơn hàng.");
      } else {
        message.error("Lỗi khi xóa nhân viên.");
      }
    },
  });

  const openCreateModal = () => {
    setEditingEmployee(null);
    form.resetFields();
    form.setFieldsValue({ status: "ACTIVE" });
    setModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    form.setFieldsValue({
      fullName: emp.fullName,
      phone: emp.phone,
      email: emp.email,
      position: emp.position,
      status: emp.status,
    });
    setModalOpen(true);
  };

  const handleFormSubmit = (values: EmployeeInput) => {
    if (editingEmployee) {
      updateMutation.mutate({
        id: editingEmployee.id,
        input: values,
        version: editingEmployee.version,
      });
    } else {
      createMutation.mutate(values);
    }
  };

  const columns = [
    {
      title: "Mã NV",
      dataIndex: "code",
      key: "code",
      width: 120,
      render: (code: string) => <code>{code}</code>,
    },
    {
      title: "Họ và tên",
      dataIndex: "fullName",
      key: "fullName",
      render: (name: string, record: Employee) => (
        <a onClick={() => navigate(`/employees/${record.id}`)} style={{ fontWeight: 600 }}>
          {name}
        </a>
      ),
    },
    {
      title: "Chức vụ / Vị trí",
      dataIndex: "position",
      key: "position",
    },
    {
      title: "Số điện thoại",
      dataIndex: "phone",
      key: "phone",
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "Tài khoản hệ thống",
      dataIndex: "accountId",
      key: "accountId",
      render: (accId: string | null) =>
        accId ? <span style={{ color: "#52c41a" }}>✓ Đã có tài khoản</span> : <span style={{ color: "#fa8c16" }}>Chưa tạo</span>,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (status: string) => <StatusBadge type="active" status={status} />,
    },
    {
      title: "Cập nhật",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 160,
      render: (date: string) => formatDateTime(date),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 130,
      render: (_: unknown, record: Employee) => (
        <Space size="small">
          <Tooltip title="Xem chi tiết & gán vai trò">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/employees/${record.id}`)}
            />
          </Tooltip>
          <PermissionGuard permission="employees.update">
            <Tooltip title="Chỉnh sửa thông tin">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEditModal(record)}
              />
            </Tooltip>
          </PermissionGuard>
          <PermissionGuard permission="employees.delete">
            <Popconfirm
              title="Xóa nhân viên"
              description="Bạn có chắc chắn muốn xóa nhân viên này?"
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={() => deleteMutation.mutate(record.id)}
            >
              <Tooltip title="Xóa">
                <Button type="text" danger size="small" icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Quản lý nhân viên
          </Title>
          <Text type="secondary">Danh sách nhân sự, phân quyền và cấp tài khoản người dùng</Text>
        </div>

        <PermissionGuard permission="employees.create">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
            style={{ backgroundColor: "#c05c74", borderColor: "#c05c74" }}
          >
            Thêm nhân viên mới
          </Button>
        </PermissionGuard>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="Tìm theo tên, email, SĐT, mã NV..."
            prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            placeholder="Lọc theo trạng thái"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 180 }}
            allowClear
            options={[
              { value: "ACTIVE", label: "Đang hoạt động" },
              { value: "INACTIVE", label: "Ngừng hoạt động" },
            ]}
          />
          <Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()}>
            Làm mới
          </Button>
        </Space>
      </Card>

      <ApiStateWrapper
        isLoading={isLoading}
        isError={isError}
        error={error}
        isEmpty={!data || data.data.length === 0}
        emptyDescription="Không tìm thấy nhân viên nào"
        onRetry={() => refetch()}
      >
        {data && (
          <Table
            dataSource={data.data}
            columns={columns}
            rowKey="id"
            pagination={{
              current: data.meta.page,
              pageSize: data.meta.limit,
              total: data.meta.total,
              showSizeChanger: true,
              onChange: (p, l) => {
                setPage(p);
                setLimit(l);
              },
            }}
          />
        )}
      </ApiStateWrapper>

      <Modal
        title={editingEmployee ? "Chỉnh sửa thông tin nhân viên" : "Thêm nhân viên mới"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingEmployee(null);
        }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={editingEmployee ? "Lưu thay đổi" : "Tạo nhân viên"}
        cancelText="Hủy"
        okButtonProps={{ style: { backgroundColor: "#c05c74", borderColor: "#c05c74" } }}
      >
        <Form form={form} layout="vertical" onFinish={handleFormSubmit} requiredMark="optional">
          <Form.Item
            name="fullName"
            label="Họ và tên"
            rules={[{ required: true, message: "Vui lòng nhập họ và tên nhân viên" }]}
          >
            <Input placeholder="Nguyễn Văn A" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Số điện thoại"
            rules={[{ required: true, message: "Vui lòng nhập số điện thoại" }]}
          >
            <Input placeholder="0912345678" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Vui lòng nhập email" },
              { type: "email", message: "Email không hợp lệ" },
            ]}
          >
            <Input placeholder="nhanvien@halora.vn" />
          </Form.Item>

          <Form.Item
            name="position"
            label="Vị trí / Chức vụ"
            rules={[{ required: true, message: "Vui lòng nhập chức vụ" }]}
          >
            <Input placeholder="Nhân viên bán hàng, Thủ kho, Kế toán..." />
          </Form.Item>

          <Form.Item
            name="status"
            label="Trạng thái"
            rules={[{ required: true, message: "Vui lòng chọn trạng thái" }]}
          >
            <Select
              options={[
                { value: "ACTIVE", label: "Đang hoạt động" },
                { value: "INACTIVE", label: "Ngừng hoạt động" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
