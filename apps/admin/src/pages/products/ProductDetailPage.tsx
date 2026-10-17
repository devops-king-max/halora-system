import React, { useState } from "react";
import {
  Typography,
  Descriptions,
  Tabs,
  Button,
  Table,
  Card,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Tag,
  Popconfirm,
  message,
  Upload,
  Image,
  Tooltip,
} from "antd";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  PictureOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../api";
import { ApiStateWrapper } from "../../components/common/ApiStateWrapper";
import { StatusBadge } from "../../components/common/StatusBadge";
import { PermissionGuard } from "../../components/common/PermissionGuard";
import { formatVnd, formatDateTime } from "../../utils/format";
import { ApiClientError } from "@halora/api-client";
import type {
  ProductVariant,
  VariantInput,
  ProductImage,
  ProductImageInput,
} from "@halora/api-client";

const { Title, Text } = Typography;

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Modals state
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [variantForm] = Form.useForm();

  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<ProductImage | null>(null);
  const [imageForm] = Form.useForm();
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadedMediaId, setUploadedMediaId] = useState<string | null>(null);

  // 1. Fetch Product Detail
  const {
    data: product,
    isLoading: productLoading,
    isError: productError,
    error: pError,
    refetch: refetchProduct,
  } = useQuery({
    queryKey: ["admin", "products", id],
    queryFn: () => apiClient.products.getAdmin(id!),
    enabled: !!id,
  });

  // 2. Fetch Variants
  const {
    data: variantsData,
    isLoading: variantsLoading,
    refetch: refetchVariants,
  } = useQuery({
    queryKey: ["admin", "products", id, "variants"],
    queryFn: () => apiClient.products.listVariants(id!),
    enabled: !!id,
  });

  // 3. Fetch Images
  const {
    data: imagesData,
    isLoading: imagesLoading,
    refetch: refetchImages,
  } = useQuery({
    queryKey: ["admin", "products", id, "images"],
    queryFn: () => apiClient.products.listImages(id!),
    enabled: !!id,
  });

  // Variant Mutations
  const createVariantMutation = useMutation({
    mutationFn: (input: VariantInput) => apiClient.products.createVariant(id!, input),
    onSuccess: () => {
      message.success("Thêm biến thể thành công!");
      setVariantModalOpen(false);
      variantForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "products", id, "variants"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message || `Lỗi: ${err.code}`);
      } else {
        message.error("Lỗi khi thêm biến thể.");
      }
    },
  });

  const updateVariantMutation = useMutation({
    mutationFn: ({ variantId, input, version }: { variantId: string; input: VariantInput; version: number }) =>
      apiClient.products.updateVariant(id!, variantId, { ...input, version }),
    onSuccess: () => {
      message.success("Cập nhật biến thể thành công!");
      setVariantModalOpen(false);
      setEditingVariant(null);
      variantForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "products", id, "variants"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        if (err.code === "VERSION_CONFLICT") {
          message.error("Biến thể đã bị thay đổi bởi người khác. Vui lòng tải lại.");
        } else {
          message.error(err.message || `Lỗi: ${err.code}`);
        }
      } else {
        message.error("Lỗi cập nhật biến thể.");
      }
    },
  });

  const deleteVariantMutation = useMutation({
    mutationFn: (variantId: string) => apiClient.products.deleteVariant(id!, variantId),
    onSuccess: () => {
      message.success("Đã xóa biến thể thành công!");
      queryClient.invalidateQueries({ queryKey: ["admin", "products", id, "variants"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message || "Không thể xóa biến thể đã phát sinh lịch sử kho/đơn hàng.");
      } else {
        message.error("Lỗi khi xóa biến thể.");
      }
    },
  });

  // Image Mutations
  const addImageMutation = useMutation({
    mutationFn: (input: ProductImageInput) => apiClient.products.createImage(id!, input),
    onSuccess: () => {
      message.success("Thêm ảnh cho sản phẩm thành công!");
      setImageModalOpen(false);
      setUploadedMediaId(null);
      imageForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "products", id, "images"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message);
      } else {
        message.error("Lỗi khi liên kết ảnh.");
      }
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: (imageId: string) => apiClient.products.deleteImage(id!, imageId),
    onSuccess: () => {
      message.success("Đã xóa ảnh!");
      queryClient.invalidateQueries({ queryKey: ["admin", "products", id, "images"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message);
      } else {
        message.error("Lỗi khi xóa ảnh.");
      }
    },
  });

  const openCreateVariantModal = () => {
    setEditingVariant(null);
    variantForm.resetFields();
    variantForm.setFieldsValue({
      status: "ACTIVE",
      lowStockThreshold: 5,
    });
    setVariantModalOpen(true);
  };

  const openEditVariantModal = (v: ProductVariant) => {
    setEditingVariant(v);
    variantForm.setFieldsValue({
      sku: v.sku,
      name: v.name,
      color: v.color,
      volumeMl: v.volumeMl,
      weightGrams: v.weightGrams,
      salePrice: v.salePrice,
      referenceCostPrice: v.referenceCostPrice,
      lowStockThreshold: v.lowStockThreshold,
      status: v.status,
    });
    setVariantModalOpen(true);
  };

  const handleVariantSubmit = (values: VariantInput) => {
    // Ensure Money is string
    const payload: VariantInput = {
      ...values,
      salePrice: String(values.salePrice),
      referenceCostPrice: values.referenceCostPrice ? String(values.referenceCostPrice) : null,
    };

    if (editingVariant) {
      updateVariantMutation.mutate({
        variantId: editingVariant.id,
        input: payload,
        version: editingVariant.version,
      });
    } else {
      createVariantMutation.mutate(payload);
    }
  };

  const handleMediaUpload = async (file: File) => {
    setUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const media = await apiClient.media.upload(formData);
      setUploadedMediaId(media.id);
      imageForm.setFieldValue("mediaId", media.id);
      message.success("Tải tệp ảnh lên máy chủ thành công!");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        message.error(err.message);
      } else {
        message.error("Lỗi khi tải ảnh lên.");
      }
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleImageSubmit = (values: ProductImageInput) => {
    addImageMutation.mutate({
      mediaId: values.mediaId || uploadedMediaId!,
      variantId: values.variantId || null,
      altText: values.altText || null,
      sortOrder: values.sortOrder || 0,
    });
  };

  const variantColumns = [
    {
      title: "SKU",
      dataIndex: "sku",
      key: "sku",
      render: (sku: string) => <code>{sku}</code>,
    },
    {
      title: "Tên biến thể",
      dataIndex: "name",
      key: "name",
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: "Màu sắc",
      dataIndex: "color",
      key: "color",
      render: (c: string | null) => c || "—",
    },
    {
      title: "Quy cách",
      key: "spec",
      render: (_: unknown, r: ProductVariant) => {
        const parts = [];
        if (r.volumeMl) parts.push(`${r.volumeMl}ml`);
        if (r.weightGrams) parts.push(`${r.weightGrams}g`);
        return parts.length ? parts.join(" / ") : "—";
      },
    },
    {
      title: "Giá bán",
      dataIndex: "salePrice",
      key: "salePrice",
      render: (p: string) => <Text strong style={{ color: "#c05c74" }}>{formatVnd(p)}</Text>,
    },
    {
      title: "Giá vốn tham khảo",
      dataIndex: "referenceCostPrice",
      key: "referenceCostPrice",
      render: (p: string | null) => (p ? formatVnd(p) : "—"),
    },
    {
      title: "Tồn kho",
      dataIndex: "stockQuantity",
      key: "stockQuantity",
      render: (qty: number, r: ProductVariant) => (
        <span style={{ color: qty <= r.lowStockThreshold ? "#cf1322" : "inherit", fontWeight: 600 }}>
          {qty}
        </span>
      ),
    },
    {
      title: "Ngưỡng cảnh báo",
      dataIndex: "lowStockThreshold",
      key: "lowStockThreshold",
      render: (val: number) => val,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (st: string) => <StatusBadge type="active" status={st} />,
    },
    {
      title: "Thao tác",
      key: "action",
      width: 110,
      render: (_: unknown, record: ProductVariant) => (
        <Space size="small">
          <PermissionGuard permission="products.update">
            <Tooltip title="Sửa biến thể">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEditVariantModal(record)}
              />
            </Tooltip>
          </PermissionGuard>
          <PermissionGuard permission="products.delete">
            <Popconfirm
              title="Xóa biến thể"
              description="Bạn có chắc muốn xóa biến thể này?"
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={() => deleteVariantMutation.mutate(record.id)}
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
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/products")}>
          Danh sách sản phẩm
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          Chi tiết sản phẩm: {product?.name || "Đang tải..."}
        </Title>
      </div>

      <ApiStateWrapper
        isLoading={productLoading}
        isError={productError}
        error={pError}
        onRetry={() => refetchProduct()}
      >
        {product && (
          <>
            <Card bordered={false} style={{ marginBottom: 24, background: "#fafafa" }}>
              <Descriptions title="Thông tin chung" bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
                <Descriptions.Item label="Mã sản phẩm">
                  <code>{product.code}</code>
                </Descriptions.Item>
                <Descriptions.Item label="Tên sản phẩm">
                  <Text strong>{product.name}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Slug">
                  <code>{product.slug}</code>
                </Descriptions.Item>
                <Descriptions.Item label="Nổi bật">
                  {product.isFeatured ? <Tag color="gold">Nổi bật</Tag> : "Bình thường"}
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái">
                  <StatusBadge type="active" status={product.status} />
                </Descriptions.Item>
                <Descriptions.Item label="Cập nhật lần cuối">
                  {formatDateTime(product.updatedAt)}
                </Descriptions.Item>
                <Descriptions.Item label="Mô tả" span={3}>
                  {product.description || "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Thành phần" span={3}>
                  {product.ingredients || "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Công dụng" span={3}>
                  {product.benefits || "—"}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Tabs
              defaultActiveKey="variants"
              items={[
                {
                  key: "variants",
                  label: `Biến thể sản phẩm (${variantsData?.data?.length || 0})`,
                  children: (
                    <Card
                      title="Danh sách biến thể / SKU"
                      bordered={false}
                      extra={
                        <Space>
                          <Button icon={<ReloadOutlined />} onClick={() => refetchVariants()}>
                            Làm mới
                          </Button>
                          <PermissionGuard permission="products.create">
                            <Button
                              type="primary"
                              icon={<PlusOutlined />}
                              onClick={openCreateVariantModal}
                              style={{ backgroundColor: "#c05c74", borderColor: "#c05c74" }}
                            >
                              Thêm biến thể mới
                            </Button>
                          </PermissionGuard>
                        </Space>
                      }
                    >
                      <Table
                        dataSource={variantsData?.data || []}
                        columns={variantColumns}
                        rowKey="id"
                        loading={variantsLoading}
                        pagination={false}
                      />
                    </Card>
                  ),
                },
                {
                  key: "images",
                  label: `Hình ảnh sản phẩm (${imagesData?.length || 0})`,
                  children: (
                    <Card
                      title="Quản lý thư viện ảnh"
                      bordered={false}
                      extra={
                        <Space>
                          <Button icon={<ReloadOutlined />} onClick={() => refetchImages()}>
                            Làm mới
                          </Button>
                          <PermissionGuard permission="media.create">
                            <Button
                              type="primary"
                              icon={<PlusOutlined />}
                              onClick={() => {
                                setEditingImage(null);
                                setUploadedMediaId(null);
                                imageForm.resetFields();
                                setImageModalOpen(true);
                              }}
                              style={{ backgroundColor: "#c05c74", borderColor: "#c05c74" }}
                            >
                              Thêm ảnh mới
                            </Button>
                          </PermissionGuard>
                        </Space>
                      }
                    >
                      {!imagesData || imagesData.length === 0 ? (
                        <div
                          style={{
                            padding: "48px 0",
                            textAlign: "center",
                            background: "#f9f9f9",
                            borderRadius: 8,
                            border: "1px dashed #d9d9d9",
                          }}
                        >
                          <PictureOutlined style={{ fontSize: 36, color: "#bfbfbf", marginBottom: 8 }} />
                          <div style={{ color: "#8c8c8c" }}>Chưa có ảnh nào cho sản phẩm này</div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                          {imagesData.map((img) => (
                            <Card
                              key={img.id}
                              hoverable
                              style={{ width: 220 }}
                              cover={
                                <Image
                                  src={img.url}
                                  alt={img.altText || product.name}
                                  style={{ height: 180, objectFit: "cover" }}
                                  fallback="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100%' height='100%' fill='%23f5f5f5'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='12'>Chưa có ảnh</text></svg>"
                                />
                              }
                              actions={[
                                <PermissionGuard permission="products.delete" key="delete">
                                  <Popconfirm
                                    title="Xóa ảnh này?"
                                    onConfirm={() => deleteImageMutation.mutate(img.id)}
                                    okText="Xóa"
                                    cancelText="Hủy"
                                  >
                                    <DeleteOutlined style={{ color: "#ff4d4f" }} />
                                  </Popconfirm>
                                </PermissionGuard>,
                              ]}
                            >
                              <Card.Meta
                                title={
                                  <div style={{ fontSize: 13 }}>
                                    {img.variantId
                                      ? `Biến thể: ${variantsData?.data?.find((v) => v.id === img.variantId)?.name || img.variantId}`
                                      : "Ảnh chung cho sản phẩm"}
                                  </div>
                                }
                                description={
                                  <div style={{ fontSize: 12 }}>
                                    <div>Thứ tự: {img.sortOrder}</div>
                                    <div style={{ color: "#8c8c8c" }}>{img.altText || "Không có chú thích"}</div>
                                  </div>
                                }
                              />
                            </Card>
                          ))}
                        </div>
                      )}
                    </Card>
                  ),
                },
              ]}
            />
          </>
        )}
      </ApiStateWrapper>

      {/* Modal Add / Edit Variant */}
      <Modal
        title={editingVariant ? "Chỉnh sửa biến thể" : "Thêm biến thể mới"}
        open={variantModalOpen}
        onCancel={() => {
          setVariantModalOpen(false);
          setEditingVariant(null);
        }}
        onOk={() => variantForm.submit()}
        confirmLoading={createVariantMutation.isPending || updateVariantMutation.isPending}
        okText={editingVariant ? "Lưu thay đổi" : "Tạo biến thể"}
        cancelText="Hủy"
        width={620}
        okButtonProps={{ style: { backgroundColor: "#c05c74", borderColor: "#c05c74" } }}
      >
        <Form form={variantForm} layout="vertical" onFinish={handleVariantSubmit} requiredMark="optional">
          <Form.Item
            name="sku"
            label="Mã SKU biến thể"
            rules={[{ pattern: /^SKU[0-9]{2,}$/, message: "Mã có dạng SKU01, SKU02..." }]}
          >
            <Input placeholder="Để trống để cấp tự động: SKU01, SKU02..." readOnly={!!editingVariant} />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên biến thể"
            rules={[{ required: true, message: "Vui lòng nhập tên biến thể" }]}
          >
            <Input placeholder="Ví dụ: Chai 30ml hoặc Chai 50ml, Màu Đỏ Ruby..." />
          </Form.Item>

          <Space style={{ display: "flex", width: "100%" }} size="middle">
            <Form.Item name="color" label="Màu sắc" style={{ flex: 1 }}>
              <Input placeholder="Màu Đỏ Cam..." />
            </Form.Item>
            <Form.Item name="volumeMl" label="Dung tích (ml)" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: "100%" }} placeholder="Ví dụ: 30" />
            </Form.Item>
            <Form.Item name="weightGrams" label="Khối lượng (g)" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: "100%" }} placeholder="Ví dụ: 150" />
            </Form.Item>
          </Space>

          <Space style={{ display: "flex", width: "100%" }} size="middle">
            <Form.Item
              name="salePrice"
              label="Giá bán (VND)"
              rules={[{ required: true, message: "Vui lòng nhập giá bán" }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="Ví dụ: 350000" addonAfter="₫" />
            </Form.Item>

            <Form.Item name="referenceCostPrice" label="Giá vốn tham khảo (VND)" style={{ flex: 1 }}>
              <Input placeholder="Ví dụ: 220000" addonAfter="₫" />
            </Form.Item>
          </Space>

          <Space style={{ display: "flex", width: "100%" }} size="middle">
            <Form.Item
              name="lowStockThreshold"
              label="Ngưỡng cảnh báo sắp hết hàng"
              rules={[{ required: true, message: "Vui lòng nhập ngưỡng tồn" }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={0} style={{ width: "100%" }} />
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
        </Form>
      </Modal>

      {/* Modal Add Image */}
      <Modal
        title="Thêm hình ảnh cho sản phẩm"
        open={imageModalOpen}
        onCancel={() => {
          setImageModalOpen(false);
          setEditingImage(null);
        }}
        onOk={() => imageForm.submit()}
        confirmLoading={addImageMutation.isPending}
        okText="Lưu hình ảnh"
        cancelText="Hủy"
        okButtonProps={{ style: { backgroundColor: "#c05c74", borderColor: "#c05c74" } }}
      >
        <Form form={imageForm} layout="vertical" onFinish={handleImageSubmit} requiredMark="optional">
          <Form.Item label="Chọn tệp ảnh từ máy tính">
            <Upload
              beforeUpload={(file) => {
                handleMediaUpload(file);
                return false;
              }}
              maxCount={1}
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />} loading={uploadingMedia}>
                Tải ảnh lên máy chủ
              </Button>
            </Upload>
            {uploadedMediaId && (
              <div style={{ marginTop: 8, color: "#52c41a", fontSize: 13 }}>
                ✓ Đã tải tệp ảnh lên máy chủ
              </div>
            )}
          </Form.Item>

          <Form.Item
            name="mediaId"
            hidden
            rules={[{ required: true, message: "Vui lòng tải tệp ảnh lên" }]}
          >
            <Input placeholder="UUID của tệp media tải lên" />
          </Form.Item>

          <Form.Item name="variantId" label="Gắn với biến thể cụ thể (để trống nếu là ảnh chung)">
            <Select
              allowClear
              placeholder="Ảnh chung cho toàn bộ sản phẩm"
              options={variantsData?.data?.map((v) => ({ value: v.id, label: `${v.name} (${v.sku})` })) || []}
            />
          </Form.Item>

          <Form.Item name="altText" label="Chú thích ảnh (Alt text)">
            <Input placeholder="Mặt trước chai serum, chất kem mịn..." />
          </Form.Item>

          <Form.Item name="sortOrder" label="Thứ tự hiển thị" initialValue={0}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
