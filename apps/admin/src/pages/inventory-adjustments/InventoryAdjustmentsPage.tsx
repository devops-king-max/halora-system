import React, { useState } from "react";
import {
  Typography,
  Table,
  Button,
  Select,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Card,
  Tooltip,
  Divider,
} from "antd";
import {
  PlusOutlined,
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
import { formatDateTime } from "../../utils/format";
import { ApiClientError } from "@halora/api-client";
import type { InventoryAdjustment, InventoryAdjustmentInput } from "@halora/api-client";

const { Title, Text } = Typography;

export const InventoryAdjustmentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "inventory-adjustments", page, limit, statusFilter],
    queryFn: () =>
      apiClient.inventory.listAdjustments({
        page,
        limit,
        status: statusFilter,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (input: InventoryAdjustmentInput) => apiClient.inventory.createAdjustment(input),
    onSuccess: (adj) => {
      message.success("Tạo bản nháp phiếu điều chỉnh kho thành công!");
      setModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory-adjustments"] });
      navigate(`/inventory-adjustments/${adj.id}`);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message || `Lỗi: ${err.code}`);
      } else {
        message.error("Lỗi khi tạo phiếu điều chỉnh.");
      }
    },
  });

  const openCreateModal = () => {
    form.resetFields();
    form.setFieldsValue({
      reason: "",
      items: [{ variantId: "", quantityDelta: 0 }],
    });
    setModalOpen(true);
  };

  const handleFormSubmit = (values: InventoryAdjustmentInput) => {
    createMutation.mutate(values);
  };

  const columns = [
    {
      title: "Mã phiếu điều chỉnh",
      dataIndex: "adjustmentCode",
      key: "adjustmentCode",
      width: 170,
      render: (code: string, r: InventoryAdjustment) => (
        <a onClick={() => navigate(`/inventory-adjustments/${r.id}`)}>
          <code>{code}</code>
        </a>
      ),
    },
    {
      title: "Lý do điều chỉnh",
      dataIndex: "reason",
      key: "reason",
      render: (r: string) => <Text strong>{r}</Text>,
    },
    {
      title: "Người lập",
      dataIndex: "employeeName",
      key: "employeeName",
      width: 160,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (st: string) => <StatusBadge type="document" status={st} />,
    },
    {
      title: "Thời điểm ghi nhận",
      dataIndex: "postedAt",
      key: "postedAt",
      width: 170,
      render: (d: string | null) => (d ? formatDateTime(d) : "—"),
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 170,
      render: (d: string) => formatDateTime(d),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 90,
      render: (_: unknown, record: InventoryAdjustment) => (
        <Tooltip title="Xem chi tiết & ghi nhận">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/inventory-adjustments/${record.id}`)}
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
            Phiếu điều chỉnh kho
          </Title>
          <Text type="secondary">Xử lý kiểm kê, điều chỉnh chênh lệch hàng tồn thừa/thiếu</Text>
        </div>

        <PermissionGuard permission="inventoryAdjustments.create">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
            style={{ backgroundColor: "#c05c74", borderColor: "#c05c74" }}
          >
            Lập phiếu điều chỉnh
          </Button>
        </PermissionGuard>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="Trạng thái chứng từ"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 180 }}
            allowClear
            options={[
              { value: "DRAFT", label: "Bản nháp" },
              { value: "POSTED", label: "Đã ghi nhận (cập nhật kho)" },
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
        emptyDescription="Không tìm thấy phiếu điều chỉnh kho nào"
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

      {/* Modal Create Adjustment */}
      <Modal
        title="Lập bản nháp phiếu điều chỉnh kho"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        okText="Tạo bản nháp"
        cancelText="Hủy"
        width={680}
        okButtonProps={{ style: { backgroundColor: "#c05c74", borderColor: "#c05c74" } }}
      >
        <Form form={form} layout="vertical" onFinish={handleFormSubmit} requiredMark="optional">
          <Form.Item
            name="reason"
            label="Lý do điều chỉnh kiểm kê"
            rules={[{ required: true, message: "Vui lòng nhập lý do điều chỉnh" }]}
          >
            <Input.TextArea rows={2} placeholder="Kiểm kê định kỳ tháng 10, hàng hỏng bao bì..." />
          </Form.Item>

          <Divider orientation="left">Danh sách biến thể điều chỉnh số lượng (+/-)</Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: "flex", marginBottom: 12 }} align="baseline">
                    <Form.Item
                      {...restField}
                      name={[name, "variantId"]}
                      rules={[{ required: true, message: "Nhập Variant ID" }]}
                      style={{ width: 360 }}
                    >
                      <Input placeholder="Mã UUID của biến thể (Variant ID)" />
                    </Form.Item>

                    <Form.Item
                      {...restField}
                      name={[name, "quantityDelta"]}
                      rules={[
                        { required: true, message: "Nhập số lượng lệch" },
                        () => ({
                          validator(_, value) {
                            if (value === 0) {
                              return Promise.reject(new Error("Số lượng thay đổi phải khác 0"));
                            }
                            return Promise.resolve();
                          },
                        }),
                      ]}
                      style={{ width: 160 }}
                    >
                      <InputNumber placeholder="+ tăng, - giảm" style={{ width: "100%" }} />
                    </Form.Item>

                    <MinusCircleOutlined onClick={() => remove(name)} style={{ color: "#ff4d4f" }} />
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Thêm dòng biến thể
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
