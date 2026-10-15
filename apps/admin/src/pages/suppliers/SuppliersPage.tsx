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
import type { Supplier, SupplierInput } from "@halora/api-client";

const { Title, Text } = Typography;

export const SuppliersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "suppliers", page, limit, search, statusFilter],
    queryFn: () =>
      apiClient.suppliers.listAdmin({
        page,
        limit,
        search: search || undefined,
        status: statusFilter,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
  });

  const createMutation = useMutation({
    mutationFn: (input: SupplierInput) => apiClient.suppliers.createAdmin(input),
    onSuccess: (sup) => {
      message.success("Thêm nhà cung cấp thành công!");
      setModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "suppliers"] });
      navigate(`/suppliers/${sup.id}`);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message || `Lỗi: ${err.code}`);
      } else {
        message.error("Lỗi khi thêm nhà cung cấp.");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input, version }: { id: string; input: SupplierInput; version: number }) =>
      apiClient.suppliers.updateAdmin(id, { ...input, version }),
    onSuccess: () => {
      message.success("Cập nhật nhà cung cấp thành công!");
      setModalOpen(false);
      setEditingSupplier(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "suppliers"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        if (err.code === "VERSION_CONFLICT") {
          message.error("Dữ liệu nhà cung cấp đã bị thay đổi bởi người khác. Vui lòng tải lại.");
        } else {
          message.error(err.message || `Lỗi: ${err.code}`);
        }
      } else {
        message.error("Lỗi khi cập nhật nhà cung cấp.");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.suppliers.deleteAdmin(id),
    onSuccess: () => {
      message.success("Đã xóa nhà cung cấp!");
      queryClient.invalidateQueries({ queryKey: ["admin", "suppliers"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        if (err.code === "RESOURCE_IN_USE") {
          message.warning("Nhà cung cấp đã có phiếu nhập hàng hoặc mặt hàng liên kết, không thể xóa trực tiếp.");
        } else {
          message.error(err.message || `Lỗi: ${err.code}`);
        }
      } else {
        message.error("Lỗi khi xóa nhà cung cấp.");
      }
    },
  });

  const openCreateModal = () => {
    setEditingSupplier(null);
    form.resetFields();
    form.setFieldsValue({ status: "ACTIVE" });
    setModalOpen(true);
  };

  const openEditModal = (sup: Supplier) => {
    setEditingSupplier(sup);
    form.setFieldsValue({
      name: sup.name,
      contactName: sup.contactName,
      phone: sup.phone,
      email: sup.email,
      address: sup.address,
      status: sup.status,
    });
    setModalOpen(true);
  };

  const handleFormSubmit = (values: SupplierInput) => {
    if (editingSupplier) {
      updateMutation.mutate({
        id: editingSupplier.id,
        input: values,
        version: editingSupplier.version,
      });
    } else {
      createMutation.mutate(values);
    }
  };

  const columns = [
    {
      title: "Mã NCC",
      dataIndex: "code",
      key: "code",
      width: 130,
      render: (code: string) => <code>{code}</code>,
    },
    {
      title: "Tên nhà cung cấp",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: Supplier) => (
        <a onClick={() => navigate(`/suppliers/${record.id}`)} style={{ fontWeight: 600 }}>
          {name}
        </a>
      ),
    },
    {
      title: "Người liên hệ",
      dataIndex: "contactName",
      key: "contactName",
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
      title: "Địa chỉ",
      dataIndex: "address",
      key: "address",
      ellipsis: true,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (st: string) => <StatusBadge type="active" status={st} />,
    },
    {
      title: "Cập nhật",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 160,
      render: (d: string) => formatDateTime(d),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 130,
      render: (_: unknown, record: Supplier) => (
        <Space size="small">
          <Tooltip title="Xem chi tiết & danh mục cung ứng">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/suppliers/${record.id}`)}
            />
          </Tooltip>
          <PermissionGuard permission="suppliers.update">
            <Tooltip title="Chỉnh sửa thông tin">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEditModal(record)}
              />
            </Tooltip>
          </PermissionGuard>
          <PermissionGuard permission="suppliers.delete">
            <Popconfirm
              title="Xóa nhà cung cấp"
              description="Bạn có chắc chắn muốn xóa nhà cung cấp này?"
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
            Quản lý nhà cung cấp
          </Title>
          <Text type="secondary">Đối tác cung ứng mỹ phẩm và các biến thể phân phối</Text>
        </div>

        <PermissionGuard permission="suppliers.create">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
            style={{ backgroundColor: "#c05c74", borderColor: "#c05c74" }}
          >
            Thêm nhà cung cấp
          </Button>
        </PermissionGuard>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="Tìm theo tên, mã NCC, SĐT..."
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
        emptyDescription="Không tìm thấy nhà cung cấp nào"
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
        title={editingSupplier ? "Chỉnh sửa nhà cung cấp" : "Thêm nhà cung cấp mới"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingSupplier(null);
        }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={editingSupplier ? "Lưu thay đổi" : "Tạo mới"}
        cancelText="Hủy"
        width={600}
        okButtonProps={{ style: { backgroundColor: "#c05c74", borderColor: "#c05c74" } }}
      >
        <Form form={form} layout="vertical" onFinish={handleFormSubmit} requiredMark="optional">
          <Form.Item
            name="name"
            label="Tên nhà cung cấp"
            rules={[{ required: true, message: "Vui lòng nhập tên nhà cung cấp" }]}
          >
            <Input placeholder="Công ty TNHH Phân phối Mỹ phẩm ABC" />
          </Form.Item>

          <Space style={{ display: "flex", width: "100%" }} size="middle">
            <Form.Item
              name="contactName"
              label="Người liên hệ"
              rules={[{ required: true, message: "Vui lòng nhập người liên hệ" }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="Nguyễn Văn Đại diện" />
            </Form.Item>

            <Form.Item
              name="phone"
              label="Số điện thoại"
              rules={[{ required: true, message: "Vui lòng nhập số điện thoại" }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="02812345678" />
            </Form.Item>
          </Space>

          <Space style={{ display: "flex", width: "100%" }} size="middle">
            <Form.Item
              name="email"
              label="Email liên hệ"
              rules={[
                { required: true, message: "Vui lòng nhập email" },
                { type: "email", message: "Email không hợp lệ" },
              ]}
              style={{ flex: 1 }}
            >
              <Input placeholder="contact@supplier.vn" />
            </Form.Item>

            <Form.Item
              name="status"
              label="Trạng thái"
              rules={[{ required: true, message: "Vui lòng chọn trạng thái" }]}
              style={{ flex: 1 }}
            >
              <Select
                options={[
                  { value: "ACTIVE", label: "Đang hoạt động" },
                  { value: "INACTIVE", label: "Ngừng hoạt động" },
                ]}
              />
            </Form.Item>
          </Space>

          <Form.Item
            name="address"
            label="Địa chỉ trụ sở / kho cung ứng"
            rules={[{ required: true, message: "Vui lòng nhập địa chỉ" }]}
          >
            <Input.TextArea rows={2} placeholder="Số 123 đường ABC, Quận XYZ, TP.HCM" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
