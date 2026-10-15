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
import type { Category, CategoryInput } from "@halora/api-client";

const { Title, Text } = Typography;

export const CategoriesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "categories", page, limit, search, statusFilter],
    queryFn: () =>
      apiClient.categories.listAdmin({
        page,
        limit,
        search: search || undefined,
        status: statusFilter,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
  });

  const createMutation = useMutation({
    mutationFn: (input: CategoryInput) => apiClient.categories.createAdmin(input),
    onSuccess: () => {
      message.success("Thêm loại sản phẩm thành công!");
      setModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message || `Lỗi: ${err.code}`);
      } else {
        message.error("Lỗi khi thêm loại sản phẩm.");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input, version }: { id: string; input: CategoryInput; version: number }) =>
      apiClient.categories.updateAdmin(id, { ...input, version }),
    onSuccess: () => {
      message.success("Cập nhật loại sản phẩm thành công!");
      setModalOpen(false);
      setEditingCategory(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        if (err.code === "VERSION_CONFLICT") {
          message.error("Dữ liệu đã bị thay đổi bởi người khác. Vui lòng tải lại trang.");
        } else {
          message.error(err.message || `Lỗi: ${err.code}`);
        }
      } else {
        message.error("Lỗi khi cập nhật loại sản phẩm.");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.categories.deleteAdmin(id),
    onSuccess: () => {
      message.success("Đã xóa loại sản phẩm thành công!");
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        if (err.code === "RESOURCE_IN_USE") {
          message.warning("Loại sản phẩm đã có sản phẩm liên kết, không thể xóa. Bạn có thể ngừng hoạt động loại sản phẩm này.");
        } else {
          message.error(err.message || `Lỗi: ${err.code}`);
        }
      } else {
        message.error("Lỗi khi xóa loại sản phẩm.");
      }
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (cat: Category) =>
      apiClient.categories.updateAdmin(cat.id, {
        name: cat.name,
        description: cat.description,
        status: cat.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        version: cat.version,
      }),
    onSuccess: () => {
      message.success("Cập nhật trạng thái thành công!");
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
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
    setEditingCategory(null);
    form.resetFields();
    form.setFieldsValue({ status: "ACTIVE" });
    setModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    form.setFieldsValue({
      name: cat.name,
      description: cat.description,
      status: cat.status,
    });
    setModalOpen(true);
  };

  const handleFormSubmit = (values: CategoryInput) => {
    if (editingCategory) {
      updateMutation.mutate({
        id: editingCategory.id,
        input: values,
        version: editingCategory.version,
      });
    } else {
      createMutation.mutate(values);
    }
  };

  const columns = [
    {
      title: "Mã loại",
      dataIndex: "code",
      key: "code",
      width: 130,
      render: (code: string) => <code>{code}</code>,
    },
    {
      title: "Tên loại sản phẩm",
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
      render: (_: unknown, record: Category) => (
        <Space size="small">
          <PermissionGuard permission="categories.update">
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

          <PermissionGuard permission="categories.delete">
            <Popconfirm
              title="Xóa loại sản phẩm"
              description="Bạn có chắc chắn muốn xóa loại sản phẩm này?"
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
            Quản lý loại sản phẩm
          </Title>
          <Text type="secondary">Phân loại và danh mục danh mục sản phẩm của hệ thống mỹ phẩm</Text>
        </div>

        <PermissionGuard permission="categories.create">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
            style={{ backgroundColor: "#c05c74", borderColor: "#c05c74" }}
          >
            Thêm loại sản phẩm
          </Button>
        </PermissionGuard>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="Tìm theo tên hoặc mã loại..."
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
        emptyDescription="Không tìm thấy loại sản phẩm nào phù hợp"
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
        title={editingCategory ? "Chỉnh sửa loại sản phẩm" : "Thêm loại sản phẩm mới"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingCategory(null);
        }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={editingCategory ? "Lưu thay đổi" : "Tạo mới"}
        cancelText="Hủy"
        okButtonProps={{ style: { backgroundColor: "#c05c74", borderColor: "#c05c74" } }}
      >
        <Form form={form} layout="vertical" onFinish={handleFormSubmit} requiredMark="optional">
          <Form.Item
            name="name"
            label="Tên loại sản phẩm"
            rules={[{ required: true, message: "Vui lòng nhập tên loại sản phẩm" }]}
          >
            <Input placeholder="Ví dụ: Chăm sóc da mặt, Son môi, v.v." />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Mô tả về nhóm sản phẩm này..." />
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
