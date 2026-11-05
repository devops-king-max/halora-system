import { BusinessCodeSelect } from "../../components/common/BusinessCodeSelect";
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
  DatePicker,
  InputNumber,
  message,
  Card,
  Tooltip,
  Divider,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  ReloadOutlined,
  MinusCircleOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../api";
import { ApiStateWrapper } from "../../components/common/ApiStateWrapper";
import { StatusBadge } from "../../components/common/StatusBadge";
import { PermissionGuard } from "../../components/common/PermissionGuard";
import { formatVnd, formatDateTime } from "../../utils/format";
import { ApiClientError } from "@halora/api-client";
import type { GoodsReceipt, GoodsReceiptInput, SupplierVariant } from "@halora/api-client";
import dayjs from "dayjs";

const { Title, Text } = Typography;

export const GoodsReceiptsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [supplierId, setSupplierId] = useState<string | undefined>(undefined);

  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const selectedSupplierId = Form.useWatch("supplierId", form);

  // Fetch suppliers for select
  const { data: suppliersData } = useQuery({
    queryKey: ["admin", "suppliers-select"],
    queryFn: () => apiClient.suppliers.listAdmin({ limit: 100 }),
  });

  // Fetch all of the selected supplier's quoted costs to prefill each receipt line.
  const { data: supplierVariants = [] } = useQuery({
    queryKey: ["admin", "suppliers", selectedSupplierId, "variants-for-receipt"],
    queryFn: async () => {
      const rows: SupplierVariant[] = [];
      for (let page = 1; ; page++) {
        const result = await apiClient.suppliers.listVariants(selectedSupplierId!, { page, limit: 100 });
        rows.push(...result.data);
        if (page >= result.meta.totalPages) return rows;
      }
    },
    enabled: !!selectedSupplierId,
  });

  const quoteByVariant = new Map(
    supplierVariants
      .filter((variant) => variant.status === "ACTIVE")
      .map((variant) => [variant.variantId, variant.quotedCostPrice] as const)
  );

  // Fetch goods receipts list
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "goods-receipts", page, limit, search, statusFilter, supplierId],
    queryFn: () =>
      apiClient.goodsReceipts.listAdmin({
        page,
        limit,
        search: search || undefined,
        status: statusFilter,
        supplierId,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
  });

  const createMutation = useMutation({
    mutationFn: (input: GoodsReceiptInput) => apiClient.goodsReceipts.createAdmin(input),
    onSuccess: (receipt) => {
      message.success("Tạo bản nháp phiếu nhập hàng thành công!");
      setModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "goods-receipts"] });
      navigate(`/goods-receipts/${receipt.id}`);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message || `Lỗi: ${err.code}`);
      } else {
        message.error("Lỗi khi tạo phiếu nhập hàng.");
      }
    },
  });

  const openCreateModal = () => {
    form.resetFields();
    form.setFieldsValue({
      receivedAt: dayjs(),
      items: [{ variantId: "", quantity: 1, unitCost: "" }],
    });
    setModalOpen(true);
  };

  const handleFormSubmit = (values: {
    supplierId: string;
    receivedAt: dayjs.Dayjs;
    note?: string;
    items: { variantId: string; quantity: number; unitCost: string }[];
  }) => {
    const payload: GoodsReceiptInput = {
      supplierId: values.supplierId,
      receivedAt: values.receivedAt.toISOString(),
      note: values.note,
      items: values.items.map((it) => ({
        variantId: it.variantId,
        quantity: it.quantity,
        unitCost: String(it.unitCost),
      })),
    };
    createMutation.mutate(payload);
  };

  const columns = [
    {
      title: "Mã phiếu",
      dataIndex: "receiptCode",
      key: "receiptCode",
      width: 140,
      render: (code: string, r: GoodsReceipt) => (
        <a onClick={() => navigate(`/goods-receipts/${r.id}`)}>
          <code>{code}</code>
        </a>
      ),
    },
    {
      title: "Nhà cung cấp",
      dataIndex: "supplierName",
      key: "supplierName",
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: "Người lập",
      dataIndex: "employeeName",
      key: "employeeName",
    },
    {
      title: "Ngày nhập kho",
      dataIndex: "receivedAt",
      key: "receivedAt",
      render: (d: string) => formatDateTime(d),
    },
    {
      title: "Tổng tiền nhập",
      dataIndex: "totalAmount",
      key: "totalAmount",
      render: (t: string) => <Text strong style={{ color: "#c05c74" }}>{formatVnd(t)}</Text>,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (st: string) => <StatusBadge type="document" status={st} />,
    },
    {
      title: "Thao tác",
      key: "action",
      width: 90,
      render: (_: unknown, record: GoodsReceipt) => (
        <Tooltip title="Xem chi tiết & ghi nhận">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/goods-receipts/${record.id}`)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Quản lý phiếu nhập hàng
          </Title>
          <Text type="secondary">Nhập kho mỹ phẩm từ nhà cung cấp và ghi tăng số dư tồn kho</Text>
        </div>

        <PermissionGuard permission="goodsReceipts.create">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
            style={{ backgroundColor: "#c05c74", borderColor: "#c05c74" }}
          >
            Lập phiếu nhập mới
          </Button>
        </PermissionGuard>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="Tìm theo mã phiếu nhập..."
            prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            placeholder="Nhà cung cấp"
            value={supplierId}
            onChange={setSupplierId}
            style={{ width: 200 }}
            allowClear
            options={suppliersData?.data.map((s) => ({ value: s.id, label: s.name })) || []}
          />
          <Select
            placeholder="Trạng thái chứng từ"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 170 }}
            allowClear
            options={[
              { value: "DRAFT", label: "Bản nháp" },
              { value: "POSTED", label: "Đã ghi nhận (nhập kho)" },
              { value: "CANCELLED", label: "Đã hủy" },
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
        emptyDescription="Không tìm thấy phiếu nhập hàng nào"
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

      {/* Modal Create Goods Receipt Draft */}
      <Modal
        title="Lập bản nháp phiếu nhập hàng"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        okText="Tạo bản nháp"
        cancelText="Hủy"
        width={750}
        okButtonProps={{ style: { backgroundColor: "#c05c74", borderColor: "#c05c74" } }}
      >
        <Form form={form} layout="vertical" onFinish={handleFormSubmit} requiredMark="optional">
          <Form.Item
            name="supplierId"
            label="Nhà cung cấp"
            extra="Giá vốn báo giá được điền sẵn theo nhà cung cấp và có thể sửa từng dòng trước khi ghi nhận."
            rules={[{ required: true, message: "Vui lòng chọn nhà cung cấp" }]}
          >
            <Select
              placeholder="Chọn nhà cung cấp"
              onChange={() => form.setFieldsValue({ items: [{ variantId: "", quantity: 1, unitCost: "" }] })}
              options={suppliersData?.data.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` })) || []}
            />
          </Form.Item>

          <Form.Item
            name="receivedAt"
            label="Thời điểm nhập hàng"
            rules={[{ required: true, message: "Vui lòng chọn thời gian" }]}
          >
            <DatePicker showTime style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="note" label="Ghi chú phiếu nhập">
            <Input.TextArea rows={2} placeholder="Ghi chú về lô hàng, số hóa đơn đỏ đối soát..." />
          </Form.Item>

          <Divider orientation="left">Danh sách mặt hàng biến thể nhập</Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: "flex", marginBottom: 12 }} align="baseline">
                    <Form.Item
                      {...restField}
                      name={[name, "variantId"]}
                      rules={[{ required: true, message: "Chọn biến thể" }]}
                      style={{ width: 300 }}
                    >
                      <BusinessCodeSelect
                        onChange={(value) =>
                          form.setFieldValue(
                            ["items", name, "unitCost"],
                            value ? quoteByVariant.get(value) ?? "" : ""
                          )
                        }
                      />
                    </Form.Item>

                    <Form.Item
                      {...restField}
                      name={[name, "quantity"]}
                      rules={[{ required: true, message: "Nhập số lượng" }]}
                      style={{ width: 130 }}
                    >
                      <InputNumber min={1} placeholder="Số lượng" style={{ width: "100%" }} />
                    </Form.Item>

                    <Form.Item
                      {...restField}
                      name={[name, "unitCost"]}
                      rules={[{ required: true, message: "Nhập giá vốn báo giá" }]}
                      style={{ width: 200 }}
                    >
                      <Input placeholder="Giá vốn báo giá" addonAfter="₫" />
                    </Form.Item>

                    <MinusCircleOutlined onClick={() => remove(name)} style={{ color: "#ff4d4f" }} />
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Thêm dòng mặt hàng
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
};
