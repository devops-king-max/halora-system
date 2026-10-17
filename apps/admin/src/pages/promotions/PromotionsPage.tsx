import React, { useState } from "react";
import { BusinessCodeSelect } from "../../components/common/BusinessCodeSelect";
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
import type { Promotion, PromotionInput, PromotionStatus, PromotionType } from "@halora/api-client";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const promotionTypes = [{value:'PRODUCT',label:'Theo sản phẩm'},{value:'ORDER',label:'Theo hóa đơn'},{value:'VOUCHER',label:'Theo voucher'}];

export const PromotionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PromotionStatus | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<PromotionType | undefined>();
  const [dateFilter, setDateFilter] = useState<[string, string] | undefined>();
  const [productFilter, setProductFilter] = useState<string | undefined>();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "promotions", page, limit, search, statusFilter, typeFilter, dateFilter, productFilter],
    queryFn: () =>
      apiClient.promotions.listAdmin({
        page,
        limit,
        search: search || undefined,
        status: statusFilter,
        type: typeFilter,
        from: dateFilter?.[0],
        to: dateFilter?.[1],
        productId: productFilter,
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
      type: p.type,
      description: p.description,
      dates: [dayjs(p.startsAt), dayjs(p.endsAt)],
      status: p.status,
    });
    setModalOpen(true);
  };

  const handleFormSubmit = (values: {
    type: PromotionType;
    name: string;
    description?: string;
    dates: [dayjs.Dayjs, dayjs.Dayjs];
    status: PromotionStatus;
  }) => {
    const payload: PromotionInput = {
      type: values.type,
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
    {title:'Loại khuyến mãi',dataIndex:'type',width:150,render:(value:PromotionType)=><Tag color="purple">{promotionTypes.find(option=>option.value===value)?.label}</Tag>},
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
      render: (st: string) => st === 'ACTIVE' ? <Tag color="blue">Đã bật</Tag> : <StatusBadge type="promotion" status={st} />,
    },
    {
      title: 'Hiệu lực', key: 'validity', width: 150,
      render: (_: unknown, r: Promotion) => r.status !== 'ACTIVE' ? 'Không áp dụng' : dayjs().isBefore(dayjs(r.startsAt)) ? <Tag>Chưa đến hạn</Tag> : dayjs().isAfter(dayjs(r.endsAt)) ? <Tag>Đã hết hạn</Tag> : <Tag color="green">Đang áp dụng</Tag>,
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
              disabled={record.hasUsage}
            >
              <Tooltip title="Xóa">
                <Button type="text" danger size="small" icon={<DeleteOutlined />} disabled={record.hasUsage} />
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
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            placeholder="Lọc theo trạng thái"
            value={statusFilter}
            onChange={(value) => { setStatusFilter(value); setPage(1); }}
            style={{ width: 180 }}
            allowClear
            options={[
              { value: "DRAFT", label: "Bản nháp" },
              { value: "ACTIVE", label: "Đã bật" },
              { value: "PAUSED", label: "Tạm dừng" },
              { value: "ENDED", label: "Đã kết thúc" },
            ]}
          />
<Select placeholder="Lọc theo loại khuyến mãi" value={typeFilter} allowClear options={promotionTypes} style={{width:210}} onChange={value=>{setTypeFilter(value);setPage(1);}} />
          <RangePicker showTime placeholder={['Áp dụng từ', 'Áp dụng đến']} onChange={value => { setDateFilter(value?.[0] && value[1] ? [value[0].toISOString(), value[1].toISOString()] : undefined); setPage(1); }} />
          <div style={{ width: 270 }}><BusinessCodeSelect kind="product" value={productFilter} onChange={value => { setProductFilter(value); setPage(1); }} /></div>
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
            scroll={{ x: 1250 }}
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
          <Form.Item name="type" label="Loại khuyến mãi" rules={[{required:true,message:'Chọn một loại khuyến mãi'}]} extra="Mỗi chương trình chỉ có một loại. Chỉ đổi loại khi chưa có điều kiện và chưa từng áp dụng.">
            <Select placeholder="Chọn một trong ba loại" options={promotionTypes} disabled={!!editingPromotion&&(editingPromotion.hasConditions||editingPromotion.hasUsage||editingPromotion.status==='ENDED')} />
          </Form.Item>
          <Form.Item
            name="name"
            label="Tên chương trình khuyến mãi"
            rules={[{ required: true, whitespace: true, message: "Vui lòng nhập tên chương trình" }]}
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
              disabled={!!editingPromotion?.hasUsage || editingPromotion?.status === 'ENDED'}
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
                { value: "ACTIVE", label: "Đã bật" },
                { value: "PAUSED", label: "Tạm dừng" },
                { value: "ENDED", label: "Đã kết thúc" },
              ].filter(option => editingPromotion?.status === 'ENDED' ? option.value === 'ENDED' : editingPromotion?.hasUsage ? option.value !== 'DRAFT' : true)}
            />
          </Form.Item>

          {editingPromotion?.hasUsage && (
            <Text type="warning" style={{ fontSize: 13 }}>
              * Chương trình đã phát sinh lượt áp dụng: giữ nguyên thời gian. Thay đổi mức giảm và điều kiện chỉ áp dụng cho lần đặt/sửa đơn tiếp theo; tiền đã chốt trên đơn cũ giữ nguyên.
            </Text>
          )}
        </Form>
      </Modal>
    </div>
  );
};
