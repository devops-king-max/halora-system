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
  message,
  Popconfirm,
  Card,
  Tooltip,
  Tag,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  GiftOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../api";
import { ApiStateWrapper } from "../../components/common/ApiStateWrapper";
import { StatusBadge } from "../../components/common/StatusBadge";
import { PermissionGuard } from "../../components/common/PermissionGuard";
import { formatDateTime } from "../../utils/format";
import { ApiClientError } from "@halora/api-client";
import type { Promotion, PromotionInput, PromotionStatus } from "@halora/api-client";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const PromotionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PromotionStatus | undefined>(undefined);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "promotions", page, limit, search, statusFilter],
    queryFn: () =>
      apiClient.promotions.listAdmin({
        page,
        limit,
        search: search || undefined,
        status: statusFilter,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
  });

  const createMutation = useMutation({
    mutationFn: (input: PromotionInput) => apiClient.promotions.createAdmin(input),
    onSuccess: (promo) => {
      message.success("Tạo chương trình khuyến mãi thành công!");
      setModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "promotions"] });
      navigate(`/promotions/${promo.id}`);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message || `Lỗi: ${err.code}`);
      } else {
        message.error("Lỗi khi tạo khuyến mãi.");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input, version }: { id: string; input: PromotionInput; version: number }) =>
      apiClient.promotions.updateAdmin(id, { ...input, version }),
    onSuccess: () => {
      message.success("Cập nhật khuyến mãi thành công!");
      setModalOpen(false);
      setEditingPromotion(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin", "promotions"] });
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
    mutationFn: (id: string) => apiClient.promotions.deleteAdmin(id),
    onSuccess: () => {
      message.success("Đã xóa chương trình khuyến mãi!");
      queryClient.invalidateQueries({ queryKey: ["admin", "promotions"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        message.error(err.message || "Không thể xóa khuyến mãi đã có lượt sử dụng.");
      } else {
        message.error("Lỗi khi xóa.");
      }
    },
  });

  const openCreateModal = () => {
    setEditingPromotion(null);
    form.resetFields();
    form.setFieldsValue({
      status: "DRAFT",
      dates: [dayjs(), dayjs().add(7, "day")],
    });
    setModalOpen(true);
  };

  const openEditModal = (p: Promotion) => {
    setEditingPromotion(p);
    form.setFieldsValue({
      name: p.name,
      description: p.description,
      dates: [dayjs(p.startsAt), dayjs(p.endsAt)],
      status: p.status,
    });
    setModalOpen(true);
  };

  const handleFormSubmit = (values: {
    name: string;
    description?: string;
    dates: [dayjs.Dayjs, dayjs.Dayjs];
    status: PromotionStatus;
  }) => {
    const payload: PromotionInput = {
      name: values.name,
      description: values.description || null,
      startsAt: values.dates[0].toISOString(),
      endsAt: values.dates[1].toISOString(),
      status: values.status,
    };

    if (editingPromotion) {
      updateMutation.mutate({
        id: editingPromotion.id,
        input: payload,
        version: editingPromotion.version,
      });
    } else {
      createMutation.mutate(payload);
    }
  };

  const columns = [
    {
      title: "Mã CTKM",
      dataIndex: "code",
      key: "code",
      width: 130,
      render: (code: string, r: Promotion) => (
        <a onClick={() => navigate(`/promotions/${r.id}`)}>
          <code>{code}</code>
        </a>
      ),
    },
    {
      title: "Tên chương trình",
      dataIndex: "name",
      key: "name",
      render: (name: string, r: Promotion) => (
        <div>
          <Text strong>{name}</Text>
          {r.hasUsage && (
            <Tag color="cyan" style={{ marginLeft: 8 }}>
              Đã phát sinh lượt dùng
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: "Thời gian áp dụng",
      key: "period",
      width: 250,
      render: (_: unknown, r: Promotion) => (
        <span style={{ fontSize: 13 }}>
          {formatDateTime(r.startsAt)} — {formatDateTime(r.endsAt)}
        </span>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (st: string) => <StatusBadge type="promotion" status={st} />,
    },
    {
      title: "Thao tác",
      key: "action",
      width: 130,
      render: (_: unknown, record: Promotion) => (
        <Space size="small">
          <Tooltip title="Xem chi tiết & cấu hình rule">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/promotions/${record.id}`)}
            />
          </Tooltip>
          <PermissionGuard permission="promotions.update">
            <Tooltip title="Chỉnh sửa thông tin">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEditModal(record)}
              />
            </Tooltip>
          </PermissionGuard>
          <PermissionGuard permission="promotions.delete">
            <Popconfirm
              title="Xóa khuyến mãi"
              description="Bạn có chắc chắn muốn xóa chương trình này?"
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
            Quản lý khuyến mãi & Voucher
          </Title>
          <Text type="secondary">Chương trình ưu đãi sản phẩm, giảm giá đơn hàng và mã voucher</Text>
        </div>

        <PermissionGuard permission="promotions.create">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
            style={{ backgroundColor: "#c05c74", borderColor: "#c05c74" }}
          >
            Tạo chương trình khuyến mãi
          </Button>
        </PermissionGuard>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="Tìm theo tên hoặc mã CTKM..."
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
              { value: "DRAFT", label: "Bản nháp" },
              { value: "ACTIVE", label: "Đang diễn ra" },
              { value: "PAUSED", label: "Tạm dừng" },
              { value: "ENDED", label: "Đã kết thúc" },
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
        emptyDescription="Không tìm thấy chương trình khuyến mãi nào"
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

      {/* Modal Create / Edit Promotion */}
      <Modal
        title={editingPromotion ? "Chỉnh sửa chương trình khuyến mãi" : "Tạo chương trình khuyến mãi"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingPromotion(null);
        }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={editingPromotion ? "Lưu thay đổi" : "Tạo chương trình"}
        cancelText="Hủy"
        width={620}
        okButtonProps={{ style: { backgroundColor: "#c05c74", borderColor: "#c05c74" } }}
      >
        <Form form={form} layout="vertical" onFinish={handleFormSubmit} requiredMark="optional">
          <Form.Item
            name="name"
            label="Tên chương trình khuyến mãi"
            rules={[{ required: true, message: "Vui lòng nhập tên chương trình" }]}
          >
            <Input placeholder="Ví dụ: Đại tiệc Mỹ phẩm Mùa thu, Flash sale 10/10..." />
          </Form.Item>

          <Form.Item name="description" label="Mô tả ưu đãi">
            <Input.TextArea rows={3} placeholder="Mô tả thể lệ và điều kiện áp dụng..." />
          </Form.Item>

          <Form.Item
            name="dates"
            label="Thời gian áp dụng (Bắt đầu - Kết thúc)"
            rules={[{ required: true, message: "Vui lòng chọn khoảng thời gian" }]}
          >
            <RangePicker
              showTime
              style={{ width: "100%" }}
              disabled={!!editingPromotion?.hasUsage}
            />
          </Form.Item>

          <Form.Item
            name="status"
            label="Trạng thái"
            rules={[{ required: true, message: "Vui lòng chọn trạng thái" }]}
          >
            <Select
              options={[
                { value: "DRAFT", label: "Bản nháp" },
                { value: "ACTIVE", label: "Đang diễn ra" },
                { value: "PAUSED", label: "Tạm dừng" },
                { value: "ENDED", label: "Đã kết thúc" },
              ]}
            />
          </Form.Item>

          {editingPromotion?.hasUsage && (
            <Text type="warning" style={{ fontSize: 13 }}>
              * Lưu ý: Chương trình đã phát sinh lượt áp dụng trong đơn hàng, thời gian và điều kiện thương mại không được phép sửa đổi.
            </Text>
          )}
        </Form>
      </Modal>
    </div>
  );
};
