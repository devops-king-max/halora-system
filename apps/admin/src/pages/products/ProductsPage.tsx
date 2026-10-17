import { ThumbnailModal, ThumbnailUpload } from "../../components/common/ThumbnailUpload";
import React, { useState } from "react";
import {
  Typography,
  Image,
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
  Switch,
  Tag,
} from "antd";
import {
  PlusOutlined,
  PictureOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  StarOutlined,
  StarFilled,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../api";
import { ApiStateWrapper } from "../../components/common/ApiStateWrapper";
import { StatusBadge } from "../../components/common/StatusBadge";
import { PermissionGuard } from "../../components/common/PermissionGuard";
import { formatDateTime } from "../../utils/format";
import { ApiClientError } from "@halora/api-client";
import type { Product, ProductInput } from "@halora/api-client";

const { Title, Text } = Typography;

export const ProductsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [brandId, setBrandId] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form] = Form.useForm();
  const [imageUploading, setImageUploading] = useState(false);
  const [thumbnailTarget, setThumbnailTarget] = useState<Product | null>(null);

  // Fetch active categories for dropdown
  const { data: categoriesData } = useQuery({
    queryKey: ["admin", "categories-select"],
    queryFn: () => apiClient.categories.listAdmin({ limit: 100 }),
  });

  // Fetch active brands for dropdown
  const { data: brandsData } = useQuery({
    queryKey: ["admin", "brands-select"],
    queryFn: () => apiClient.brands.listAdmin({ limit: 100 }),
  });

  // Fetch products
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "products", page, limit, search, categoryId, brandId, statusFilter],
    queryFn: () =>
      apiClient.products.listAdmin({
        page,
        limit,
        search: search || undefined,
        categoryId,
        brandId,
        status: statusFilter,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
  });

  const createMutation = useMutation({
    mutationFn: (input: ProductInput) => apiClient.products.createAdmin(input),
    onSuccess: (created) => {
      message.success("Thêm sản phẩm thành công!");
      setModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      navigate(`/products/${created.id}`);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message || `Lỗi: ${err.code}`);
      } else {
        message.error("Lỗi khi thêm sản phẩm.");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input, version }: { id: string; input: ProductInput; version: number }) =>
      apiClient.products.updateAdmin(id, { ...input, version }),
    onSuccess: () => {
      message.success("Cập nhật thông tin sản phẩm thành công!");
      setModalOpen(false);
      setEditingProduct(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        if (err.code === "VERSION_CONFLICT") {
          message.error("Dữ liệu đã bị thay đổi bởi người khác. Vui lòng tải lại.");
        } else {
          message.error(err.message || `Lỗi: ${err.code}`);
        }
      } else {
        message.error("Lỗi khi cập nhật sản phẩm.");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.products.deleteAdmin(id),
    onSuccess: () => {
      message.success("Đã xóa sản phẩm thành công!");
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        if (err.code === "RESOURCE_IN_USE") {
          message.warning("Sản phẩm đã có biến thể hoặc giao dịch liên kết, không thể xóa trực tiếp. Vui lòng chuyển trạng thái sang ngừng hoạt động.");
        } else {
          message.error(err.message || `Lỗi: ${err.code}`);
        }
      } else {
        message.error("Lỗi khi xóa sản phẩm.");
      }
    },
  });

  const openCreateModal = () => {
    setEditingProduct(null);
    form.resetFields();
    form.setFieldsValue({ status: "ACTIVE", isFeatured: false });
    setModalOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    form.setFieldsValue({
      thumbnailMediaId: prod.thumbnailMediaId,
      name: prod.name,
      slug: prod.slug,
      categoryId: prod.categoryId,
      brandId: prod.brandId,
      description: prod.description,
      ingredients: prod.ingredients,
      benefits: prod.benefits,
      isFeatured: prod.isFeatured,
      status: prod.status,
    });
    setModalOpen(true);
  };

  const handleFormSubmit = (values: ProductInput) => {
    if (editingProduct) {
      updateMutation.mutate({
        id: editingProduct.id,
        input: values,
        version: editingProduct.version,
      });
    } else {
      createMutation.mutate(values);
    }
  };

  // Helper to map category and brand name from cached dropdowns
  const getCategoryName = (id: string) => {
    const cat = categoriesData?.data.find((c) => c.id === id);
    return cat ? cat.name : "—";
  };

  const getBrandName = (id: string) => {
    const brand = brandsData?.data.find((b) => b.id === id);
    return brand ? brand.name : "—";
  };

  const columns = [
    {
      title: 'Ảnh đại diện',
      key: 'thumbnail',
      width: 112,
      render: (_: unknown, record: Product) => <Space direction="vertical" size={4}>
        {record.thumbnailUrl ? <Image src={record.thumbnailUrl} alt={record.name} width={56} height={56} style={{ objectFit: 'cover', borderRadius: 6 }} /> : <Text type="secondary">Chưa có ảnh</Text>}
        <PermissionGuard permission="products.update"><Button size="small" type="text" icon={<PictureOutlined />} aria-label={`Tải ảnh đại diện ${record.code}`} onClick={() => setThumbnailTarget(record)}>Tải ảnh</Button></PermissionGuard>
      </Space>,
    },
    {
      title: "Mã SP",
      dataIndex: "code",
      key: "code",
      width: 120,
      render: (code: string) => <code>{code}</code>,
    },
    {
      title: "Tên sản phẩm",
      dataIndex: "name",
      key: "name",
      width: 240,
      render: (name: string, record: Product) => (
        <div>
          <a
            onClick={() => navigate(`/products/${record.id}`)}
            style={{ fontWeight: 600, color: "#1f1f1f" }}
          >
            {name}
          </a>
          {record.isFeatured && (
            <Tag color="gold" style={{ marginLeft: 8 }}>
              <StarFilled /> Nổi bật
            </Tag>
          )}
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>{record.slug}</div>
        </div>
      ),
    },
    {
      title: "Loại sản phẩm",
      dataIndex: "categoryId",
      key: "categoryId",
      render: (id: string) => <Tag color="blue">{getCategoryName(id)}</Tag>,
    },
    {
      title: "Thương hiệu",
      dataIndex: "brandId",
      key: "brandId",
      render: (id: string) => <Tag color="purple">{getBrandName(id)}</Tag>,
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
      width: 140,
      render: (_: unknown, record: Product) => (
        <Space size="small">
          <Tooltip title="Xem chi tiết & biến thể">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/products/${record.id}`)}
            />
          </Tooltip>
          <PermissionGuard permission="products.update">
            <Tooltip title="Chỉnh sửa thông tin">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEditModal(record)}
              />
            </Tooltip>
          </PermissionGuard>
          <PermissionGuard permission="products.delete">
            <Popconfirm
              title="Xóa sản phẩm"
              description="Bạn có chắc chắn muốn xóa sản phẩm này?"
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
            Quản lý sản phẩm
          </Title>
          <Text type="secondary">Các sản phẩm mỹ phẩm và thông tin trên toàn hệ thống</Text>
        </div>

        <PermissionGuard permission="products.create">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
            style={{ backgroundColor: "#c05c74", borderColor: "#c05c74" }}
          >
            Thêm sản phẩm mới
          </Button>
        </PermissionGuard>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="Tìm theo tên, mã sản phẩm..."
            prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Select
            placeholder="Loại sản phẩm"
            value={categoryId}
            onChange={setCategoryId}
            style={{ width: 180 }}
            allowClear
            options={categoriesData?.data.map((c) => ({ value: c.id, label: c.name })) || []}
          />
          <Select
            placeholder="Thương hiệu"
            value={brandId}
            onChange={setBrandId}
            style={{ width: 180 }}
            allowClear
            options={brandsData?.data.map((b) => ({ value: b.id, label: b.name })) || []}
          />
          <Select
            placeholder="Trạng thái"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 160 }}
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
        emptyDescription="Không tìm thấy sản phẩm nào"
        onRetry={() => refetch()}
      >
        {data && (
          <Table
            dataSource={data.data}
            columns={columns}
            rowKey="id"
            scroll={{ x: 1300 }}
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
        title={editingProduct ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingProduct(null);
        }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okButtonProps={{ disabled: imageUploading, style: { backgroundColor: "#c05c74", borderColor: "#c05c74" } }}
        okText={editingProduct ? "Lưu thay đổi" : "Tạo sản phẩm"}
        cancelText="Hủy"
        width={680}
      >
        <Form form={form} layout="vertical" onFinish={handleFormSubmit} requiredMark="optional">
          <Form.Item name="thumbnailMediaId" label="Ảnh đại diện"><ThumbnailUpload key={editingProduct?.id || 'new'} initialUrl={editingProduct?.thumbnailUrl} onUploadingChange={setImageUploading} /></Form.Item>
          <Form.Item
            name="name"
            label="Tên sản phẩm"
            rules={[{ required: true, message: "Vui lòng nhập tên sản phẩm" }]}
          >
            <Input
              placeholder="Ví dụ: Serum phục hồi da B5 La Roche-Posay"
              onChange={(e) => {
                if (!editingProduct) {
                  // auto generate basic slug suggestion
                  const s = e.target.value
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-+|-+$/g, "");
                  form.setFieldValue("slug", s);
                }
              }}
            />
          </Form.Item>

          <Form.Item
            name="slug"
            label="Đường dẫn tĩnh (Slug)"
            rules={[{ required: true, message: "Vui lòng nhập slug sản phẩm" }]}
          >
            <Input placeholder="vi-du-serum-phuc-hoi-da-b5" />
          </Form.Item>

          <Space style={{ display: "flex", width: "100%" }} size="middle">
            <Form.Item
              name="categoryId"
              label="Loại sản phẩm"
              rules={[{ required: true, message: "Vui lòng chọn loại sản phẩm" }]}
              style={{ flex: 1 }}
            >
              <Select
                placeholder="Chọn loại sản phẩm"
                options={categoriesData?.data.map((c) => ({ value: c.id, label: c.name })) || []}
              />
            </Form.Item>

            <Form.Item
              name="brandId"
              label="Thương hiệu"
              rules={[{ required: true, message: "Vui lòng chọn thương hiệu" }]}
              style={{ flex: 1 }}
            >
              <Select
                placeholder="Chọn thương hiệu"
                options={brandsData?.data.map((b) => ({ value: b.id, label: b.name })) || []}
              />
            </Form.Item>
          </Space>

          <Form.Item name="description" label="Mô tả sản phẩm">
            <Input.TextArea rows={3} placeholder="Mô tả chi tiết về công dụng và đặc điểm sản phẩm..." />
          </Form.Item>

          <Form.Item name="ingredients" label="Thành phần">
            <Input.TextArea rows={2} placeholder="Niacinamide, Hyaluronic Acid, Panthenol..." />
          </Form.Item>

          <Form.Item name="benefits" label="Công dụng chính">
            <Input.TextArea rows={2} placeholder="Dưỡng ẩm, phục hồi hàng rào bảo vệ da..." />
          </Form.Item>

          <Space size="large" style={{ marginBottom: 12 }}>
            <Form.Item name="isFeatured" label="Sản phẩm nổi bật" valuePropName="checked">
              <Switch />
            </Form.Item>

            <Form.Item
              name="status"
              label="Trạng thái"
              rules={[{ required: true, message: "Vui lòng chọn trạng thái" }]}
            >
              <Select
                style={{ width: 180 }}
                options={[
                  { value: "ACTIVE", label: "Đang hoạt động" },
                  { value: "INACTIVE", label: "Ngừng hoạt động" },
                ]}
              />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
      {thumbnailTarget && <ThumbnailModal key={thumbnailTarget.id} record={thumbnailTarget} resource="products" onClose={() => setThumbnailTarget(null)} />}
    </div>
  );
};
