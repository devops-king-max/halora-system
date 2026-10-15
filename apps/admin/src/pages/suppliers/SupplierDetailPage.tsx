import React, { useState } from "react";
import {
  Typography,
  Descriptions,
  Button,
  Table,
  Card,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Popconfirm,
  message,
  Tooltip,
} from "antd";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
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
import type { SupplierVariant, SupplierVariantInput } from "@halora/api-client";

const { Title, Text } = Typography;

export const SupplierDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingVariantLink, setEditingVariantLink] = useState<SupplierVariant | null>(null);
  const [form] = Form.useForm();

  // 1. Fetch Supplier Detail
  const {
    data: supplier,
    isLoading: supplierLoading,
    isError: supplierError,
    error: sError,
    refetch: refetchSupplier,
  } = useQuery({
    queryKey: ["admin", "suppliers", id],
    queryFn: () => apiClient.suppliers.getAdmin(id!),
    enabled: !!id,
  });

  // 2. Fetch Supplied Variants
  const {
    data: variantsData,
    isLoading: variantsLoading,
    refetch: refetchVariants,
  } = useQuery({
    queryKey: ["admin", "suppliers", id, "variants"],
    queryFn: () => apiClient.suppliers.listVariants(id!),
    enabled: !!id,
  });

  // 3. Fetch products to get variants for linking
  const { data: productsData } = useQuery({
    queryKey: ["admin", "products-for-linking"],
    queryFn: () => apiClient.products.listAdmin({ limit: 100 }),
  });

  const linkMutation = useMutation({
    mutationFn: (input: SupplierVariantInput) => apiClient.suppliers.createVariant(id!, input),
    onSuccess: () => {
      message.success("Liên kết mặt hàng cung ứng thành công!");
      setModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "suppliers", id, "variants"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message || `Lỗi: ${err.code}`);
      } else {
        message.error("Lỗi khi liên kết mặt hàng.");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ linkId, quotedCostPrice, status, version }: { linkId: string; quotedCostPrice: string; status: string; version: number }) =>
      apiClient.suppliers.updateVariant(id!, linkId, { quotedCostPrice, status, version }),
    onSuccess: () => {
      message.success("Cập nhật giá vốn báo giá thành công!");
      setModalOpen(false);
      setEditingVariantLink(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "suppliers", id, "variants"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        if (err.code === "VERSION_CONFLICT") {
          message.error("Dữ liệu đã bị thay đổi bởi người khác. Vui lòng tải lại.");
        } else {
          message.error(err.message || `Lỗi: ${err.code}`);
        }
      } else {
        message.error("Lỗi khi cập nhật.");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (linkId: string) => apiClient.suppliers.deleteVariant(id!, linkId),
    onSuccess: () => {
      message.success("Đã xóa liên kết mặt hàng!");
      queryClient.invalidateQueries({ queryKey: ["admin", "suppliers", id, "variants"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message);
      } else {
        message.error("Lỗi khi xóa liên kết.");
      }
    },
  });

  const openLinkModal = () => {
    setEditingVariantLink(null);
    form.resetFields();
    form.setFieldsValue({ status: "ACTIVE" });
    setModalOpen(true);
  };

  const openEditModal = (v: SupplierVariant) => {
    setEditingVariantLink(v);
    form.setFieldsValue({
      variantId: v.variantId,
      quotedCostPrice: v.quotedCostPrice,
      status: v.status,
    });
    setModalOpen(true);
  };

  const handleFormSubmit = (values: { variantId: string; quotedCostPrice: string; status: "ACTIVE" | "INACTIVE" }) => {
    if (editingVariantLink) {
      updateMutation.mutate({
        linkId: editingVariantLink.id,
        quotedCostPrice: String(values.quotedCostPrice),
        status: values.status,
        version: editingVariantLink.version,
      });
    } else {
      linkMutation.mutate({
        variantId: values.variantId,
        quotedCostPrice: String(values.quotedCostPrice),
        status: values.status,
      });
    }
  };

  const columns = [
    {
      title: "SKU",
      dataIndex: "sku",
      key: "sku",
      render: (sku: string) => <code>{sku}</code>,
    },
    {
      title: "Tên mặt hàng sản phẩm",
      dataIndex: "productName",
      key: "productName",
      render: (name: string, r: SupplierVariant) => (
        <div>
          <Text strong>{name}</Text>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>{r.variantName}</div>
        </div>
      ),
    },
    {
      title: "Giá vốn báo giá",
      dataIndex: "quotedCostPrice",
      key: "quotedCostPrice",
      render: (price: string) => <Text strong style={{ color: "#c05c74" }}>{formatVnd(price)}</Text>,
    },
    {
      title: "Trạng thái cung ứng",
      dataIndex: "status",
      key: "status",
      render: (st: string) => <StatusBadge type="active" status={st} />,
    },
    {
      title: "Cập nhật",
      dataIndex: "updatedAt",
      key: "updatedAt",
      render: (d: string) => formatDateTime(d),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 110,
      render: (_: unknown, record: SupplierVariant) => (
        <Space size="small">
          <PermissionGuard permission="suppliers.update">
            <Tooltip title="Chỉnh sửa giá vốn báo giá">
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
              title="Xóa liên kết cung ứng"
              description="Bạn có muốn hủy liên kết mặt hàng này với nhà cung cấp?"
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={() => deleteMutation.mutate(record.id)}
            >
              <Tooltip title="Xóa liên kết">
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/suppliers")}>
            Danh sách nhà cung cấp
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            Nhà cung cấp: {supplier?.name || "Đang tải..."}
          </Title>
        </div>

        <PermissionGuard permission="suppliers.create">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openLinkModal}
            style={{ backgroundColor: "#c05c74", borderColor: "#c05c74" }}
          >
            Liên kết biến thể cung ứng
          </Button>
        </PermissionGuard>
      </div>

      <ApiStateWrapper
        isLoading={supplierLoading}
        isError={supplierError}
        error={sError}
        onRetry={() => refetchSupplier()}
      >
        {supplier && (
          <>
            <Card bordered={false} style={{ marginBottom: 24, background: "#fafafa" }}>
              <Descriptions title="Hồ sơ nhà cung cấp" bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
                <Descriptions.Item label="Mã nhà cung cấp">
                  <code>{supplier.code}</code>
                </Descriptions.Item>
                <Descriptions.Item label="Tên công ty">
                  <Text strong>{supplier.name}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Người liên hệ">
                  {supplier.contactName}
                </Descriptions.Item>
                <Descriptions.Item label="Số điện thoại">
                  {supplier.phone}
                </Descriptions.Item>
                <Descriptions.Item label="Email">
                  {supplier.email}
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái">
                  <StatusBadge type="active" status={supplier.status} />
                </Descriptions.Item>
                <Descriptions.Item label="Địa chỉ" span={3}>
                  {supplier.address}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card
              title={`Danh mục biến thể / SKU được cung ứng (${variantsData?.meta?.total || 0})`}
              bordered={false}
              extra={
                <Button icon={<ReloadOutlined />} onClick={() => refetchVariants()}>
                  Làm mới
                </Button>
              }
            >
              <Table
                dataSource={variantsData?.data || []}
                columns={columns}
                rowKey="id"
                loading={variantsLoading}
                pagination={{
                  current: variantsData?.meta?.page,
                  pageSize: variantsData?.meta?.limit,
                  total: variantsData?.meta?.total,
                }}
              />
            </Card>
          </>
        )}
      </ApiStateWrapper>

      {/* Modal Link / Edit Supplied Variant */}
      <Modal
        title={editingVariantLink ? "Chỉnh sửa giá vốn báo giá" : "Liên kết mặt hàng cung ứng"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingVariantLink(null);
        }}
        onOk={() => form.submit()}
        confirmLoading={linkMutation.isPending || updateMutation.isPending}
        okText={editingVariantLink ? "Lưu thay đổi" : "Tạo liên kết"}
        cancelText="Hủy"
        okButtonProps={{ style: { backgroundColor: "#c05c74", borderColor: "#c05c74" } }}
      >
        <Form form={form} layout="vertical" onFinish={handleFormSubmit} requiredMark="optional">
          <Form.Item
            name="variantId"
            label="Mã định danh biến thể (Variant ID)"
            rules={[{ required: true, message: "Vui lòng nhập hoặc chọn Variant ID" }]}
          >
            <Input
              disabled={!!editingVariantLink}
              placeholder="UUID của biến thể sản phẩm (nhập từ chi tiết sản phẩm)"
            />
          </Form.Item>

          <Form.Item
            name="quotedCostPrice"
            label="Giá vốn báo giá (VND)"
            rules={[{ required: true, message: "Vui lòng nhập giá vốn báo giá" }]}
          >
            <Input placeholder="Ví dụ: 180000" addonAfter="₫" />
          </Form.Item>

          <Form.Item
            name="status"
            label="Trạng thái cung ứng"
            rules={[{ required: true, message: "Vui lòng chọn trạng thái" }]}
          >
            <Select
              options={[
                { value: "ACTIVE", label: "Đang phân phối" },
                { value: "INACTIVE", label: "Tạm dừng phân phối" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
