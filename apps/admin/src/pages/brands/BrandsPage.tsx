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
  EditOutlined,
  DeleteOutlined,
  StopOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../api";
import { ApiStateWrapper } from "../../components/common/ApiStateWrapper";
import { StatusBadge } from "../../components/common/StatusBadge";
import { PermissionGuard } from "../../components/common/PermissionGuard";
import { formatDateTime } from "../../utils/format";
import { ApiClientError } from "@halora/api-client";
import type { Brand, BrandInput } from "@halora/api-client";

const { Title, Text } = Typography;

export const BrandsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "brands", page, limit, search, statusFilter],
    queryFn: () =>
      apiClient.brands.listAdmin({
        page,
        limit,
        search: search || undefined,
        status: statusFilter,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
  });

  const createMutation = useMutation({
    mutationFn: (input: BrandInput) => apiClient.brands.createAdmin(input),
    onSuccess: () => {
      message.success("Thêm thương hiệu thành công!");
      setModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "brands"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message || `Lỗi: ${err.code}`);
      } else {
        message.error("Lỗi khi thêm thương hiệu.");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input, version }: { id: string; input: BrandInput; version: number }) =>
      apiClient.brands.updateAdmin(id, { ...input, version }),
    onSuccess: () => {
      message.success("Cập nhật thương hiệu thành công!");
      setModalOpen(false);
      setEditingBrand(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "brands"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        if (err.code === "VERSION_CONFLICT") {
          message.error("Dữ liệu đã bị thay đổi bởi người khác. Vui lòng tải lại.");
        } else {
          message.error(err.message || `Lỗi: ${err.code}`);
        }
      } else {
        message.error("Lỗi khi cập nhật thương hiệu.");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.brands.deleteAdmin(id),
    onSuccess: () => {
      message.success("Đã xóa thương hiệu thành công!");
      queryClient.invalidateQueries({ queryKey: ["admin", "brands"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        if (err.code === "RESOURCE_IN_USE") {
          message.warning("Thương hiệu đã có sản phẩm liên kết, không thể xóa. Bạn có thể ngừng hoạt động thương hiệu này.");
        } else {
          message.error(err.message || `Lỗi: ${err.code}`);
        }
      } else {
        message.error("Lỗi khi xóa thương hiệu.");
      }
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (brand: Brand) =>
      apiClient.brands.updateAdmin(brand.id, {
        name: brand.name,
        description: brand.description,
        status: brand.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        version: brand.version,
      }),
    onSuccess: () => {
      message.success("Cập nhật trạng thái thành công!");
      queryClient.invalidateQueries({ queryKey: ["admin", "brands"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message);
      } else {
        message.error("Lỗi cập nhật trạng thái.");
      }
    },
  });

  const openCreateModal = () => {
    setEditingBrand(null);
    form.resetFields();
    form.setFieldsValue({ status: "ACTIVE" });
    setModalOpen(true);
  };

  const openEditModal = (brand: Brand) => {
    setEditingBrand(brand);
    form.setFieldsValue({
      name: brand.name,
      description: brand.description,
      status: brand.status,
    });
    setModalOpen(true);
  };

  const handleFormSubmit = (values: BrandInput) => {
    if (editingBrand) {
      updateMutation.mutate({
        id: editingBrand.id,
        input: values,
        version: editingBrand.version,
      });
    } else {
      createMutation.mutate(values);
    }
  };

  const columns = [
    {
      title: "Mã thương hiệu",
      dataIndex: "code",
      key: "code",
      width: 140,
      render: (code: string) => <code>{code}</code>,
    },
    {
      title: "Tên thương hiệu",
      dataIndex: "name",
      key: "name",
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: "Mô tả",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (desc: string | null) => desc || "—",
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 150,
      render: (status: string) => <StatusBadge type="active" status={status} />,
    },
    {
      title: "Cập nhật lần cuối",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 170,
      render: (date: string) => formatDateTime(date),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 140,
      render: (_: unknown, record: Brand) => (
        <Space size="small">
          <PermissionGuard permission="brands.update">
            <Tooltip title="Chỉnh sửa">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEditModal(record)}
              />
            </Tooltip>
            <Tooltip title={record.status === "ACTIVE" ? "Ngừng hoạt động" : "Kích hoạt"}>
              <Button
                type="text"
                size="small"
                icon={record.status === "ACTIVE" ? <StopOutlined style={{ color: "#fa8c16" }} /> : <CheckCircleOutlined style={{ color: "#52c41a" }} />}
                onClick={() => toggleStatusMutation.mutate(record)}
              />
            </Tooltip>
          </PermissionGuard>

          <PermissionGuard permission="brands.delete">
            <Popconfirm
              title="Xóa thương hiệu"
              description="Bạn có chắc chắn muốn xóa thương hiệu này?"
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
            Quản lý thương hiệu
          </Title>
          <Text type="secondary">Danh sách thương hiệu mỹ phẩm phân phối trong hệ thống</Text>
        </div>

        <PermissionGuard permission="brands.create">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
            style={{ backgroundColor: "#c05c74", borderColor: "#c05c74" }}
          >
            Thêm thương hiệu
          </Button>
        </PermissionGuard>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="Tìm theo tên hoặc mã thương hiệu..."
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
        emptyDescription="Không tìm thấy thương hiệu nào phù hợp"
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
        title={editingBrand ? "Chỉnh sửa thương hiệu" : "Thêm thương hiệu mới"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingBrand(null);
        }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={editingBrand ? "Lưu thay đổi" : "Tạo mới"}
        cancelText="Hủy"
        okButtonProps={{ style: { backgroundColor: "#c05c74", borderColor: "#c05c74" } }}
      >
        <Form form={form} layout="vertical" onFinish={handleFormSubmit} requiredMark="optional">
          <Form.Item
            name="name"
            label="Tên thương hiệu"
            rules={[{ required: true, message: "Vui lòng nhập tên thương hiệu" }]}
          >
            <Input placeholder="Ví dụ: L'Oréal, Innisfree, La Roche-Posay, v.v." />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Mô tả ngắn gọn về thương hiệu..." />
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
