import React, { useState } from "react";
import {
  Typography,
  Card,
  Tabs,
  DatePicker,
  Button,
  Space,
  Row,
  Col,
  Statistic,
  Table,
  Select,
  message,
} from "antd";
import {
  ReloadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  InboxOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../api";
import { ApiStateWrapper } from "../../components/common/ApiStateWrapper";
import { formatVnd, formatDateTime } from "../../utils/format";
import { PermissionGuard } from "../../components/common/PermissionGuard";
import { ReportSeriesCharts } from "../../components/reports/ReportCharts";
import { ApiClientError } from "@halora/api-client";
import type { ReportData } from "@halora/api-client";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

type Quarter = 1 | 2 | 3 | 4;

const currentYear = Number(
  new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric" }).format(new Date()),
);
const yearOptions = Array.from({ length: 6 }, (_, index) => currentYear - index);
const quarterOptions: { value: Quarter; label: string }[] = [
  { value: 1, label: "Quý 1" },
  { value: 2, label: "Quý 2" },
  { value: 3, label: "Quý 3" },
  { value: 4, label: "Quý 4" },
];

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("sales");
  const [year, setYear] = useState<number>(currentYear);
  const [quarter, setQuarter] = useState<Quarter | undefined>(undefined);
  const [compareRange, setCompareRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [exporting, setExporting] = useState<string | null>(null);

  const queryParams = {
    year,
    quarter: activeTab === "products" ? quarter : undefined,
    compareFrom: compareRange[0]?.toISOString(),
    compareTo: compareRange[1]?.toISOString(),
  };

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ReportData>({
    queryKey: ["admin", "reports", activeTab, year, queryParams.quarter, queryParams.compareFrom, queryParams.compareTo],
    queryFn: async () => {
      switch (activeTab) {
        case "sales":
          return await apiClient.reports.getSales(queryParams);
        case "payments":
          return await apiClient.reports.getPayments(queryParams);
        case "inventory":
          return await apiClient.reports.getInventory(queryParams);
        case "purchases":
          return await apiClient.reports.getPurchases(queryParams);
        case "products":
          return await apiClient.reports.getProducts(queryParams);
        case "promotions":
          return await apiClient.reports.getPromotions(queryParams);
        case "activity":
          return await apiClient.reports.getActivity(queryParams);
        default:
          return await apiClient.reports.getSales(queryParams);
      }
    },
  });

  const handleExport = async (format: "xlsx" | "pdf") => {
    setExporting(format);
    try {
      const blob = await apiClient.reports.export(activeTab, format, queryParams);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Bao-cao-${activeTab}-${dayjs().format("YYYYMMDD")}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      message.success(`Xuất báo cáo định dạng ${format.toUpperCase()} thành công!`);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        message.error(err.message || "Không thể xuất báo cáo.");
      } else {
        message.error("Lỗi khi tải tệp báo cáo.");
      }
    } finally {
      setExporting(null);
    }
  };

  const getMetricIcon = (unit: string) => {
    switch (unit) {
      case "VND":
        return <DollarOutlined style={{ color: "#c05c74" }} />;
      case "COUNT":
        return <ShoppingCartOutlined style={{ color: "#1890ff" }} />;
      case "QUANTITY":
        return <InboxOutlined style={{ color: "#52c41a" }} />;
      default:
        return <BarChartOutlined />;
    }
  };

  const formatMetric = (val: string, unit: string) => {
    if (unit === "VND") return formatVnd(val);
    return new Intl.NumberFormat("vi-VN").format(parseInt(val, 10) || 0);
  };

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Báo cáo thống kê kinh doanh & vận hành
          </Title>
          <Text type="secondary">Phân tích chuyên sâu số liệu bán hàng, thanh toán, kho vận và khuyến mãi</Text>
        </div>

        <Space wrap>
          <PermissionGuard permission="reports.export">
            <Button
              icon={<FileExcelOutlined />}
              onClick={() => handleExport("xlsx")}
              loading={exporting === "xlsx"}
              style={{ color: "#389e0d", borderColor: "#389e0d" }}
            >
              Xuất Excel
            </Button>
            <Button
              icon={<FilePdfOutlined />}
              onClick={() => handleExport("pdf")}
              loading={exporting === "pdf"}
              style={{ color: "#c05c74", borderColor: "#c05c74" }}
            >
              Xuất PDF
            </Button>
          </PermissionGuard>

          <Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()}>
            Làm mới
          </Button>
        </Space>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <div>
            <Text type="secondary" style={{ marginRight: 8 }}>Năm báo cáo:</Text>
            <Select
              value={year}
              onChange={(value: number) => setYear(value)}
              style={{ width: 140 }}
              options={yearOptions.map((option) => ({ value: option, label: `Năm ${option}` }))}
            />
          </div>

          {activeTab === "products" && (
            <div>
              <Text type="secondary" style={{ marginRight: 8 }}>Quý:</Text>
              <Select
                allowClear
                placeholder="Cả năm"
                value={quarter}
                onChange={(value) => setQuarter(value as Quarter | undefined)}
                style={{ width: 140 }}
                options={quarterOptions}
              />
            </div>
          )}

          <div>
            <Text type="secondary" style={{ marginRight: 8 }}>Khoảng so sánh:</Text>
            <RangePicker
              value={compareRange}
              placeholder={["So sánh từ", "đến"]}
              onChange={(dates) => dates ? setCompareRange([dates[0], dates[1]]) : setCompareRange([null, null])}
            />
          </div>
        </Space>
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: "sales", label: "Báo cáo bán hàng" },
          { key: "payments", label: "Báo cáo thanh toán & đối soát" },
          { key: "inventory", label: "Báo cáo tồn kho & định giá" },
          { key: "purchases", label: "Báo cáo nhập hàng" },
          { key: "products", label: "Thống kê sản phẩm" },
          { key: "promotions", label: "Báo cáo khuyến mãi & voucher" },
          { key: "activity", label: "Nhật ký hoạt động hệ thống" },
        ]}
      />

      <ApiStateWrapper
        isLoading={isLoading}
        isError={isError}
        error={error}
        isEmpty={!data || (!data.metrics?.length && !data.rows?.length)}
        emptyDescription="Chưa có dữ liệu cho kỳ báo cáo này"
        onRetry={() => refetch()}
      >
        {data && (
          <>
            {/* Metric Summary Cards */}
            {data.metrics && data.metrics.length > 0 && (
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                {data.metrics.map((m) => (
                  <Col xs={24} sm={12} lg={6} key={m.key}>
                    <Card bordered={false} style={{ background: "#fafafa" }}>
                      <Statistic
                        title={<Text type="secondary">{m.label}</Text>}
                        value={formatMetric(m.value, m.unit)}
                        prefix={getMetricIcon(m.unit)}
                        valueStyle={{ fontSize: 20, fontWeight: 700 }}
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
            )}

            {/* Series Charts */}
            {data.series && data.series.length > 0 && <ReportSeriesCharts series={data.series} />}

            {/* Dynamic Report Table */}
            {data.columns && data.columns.length > 0 && (
              <Card title="Bảng chi tiết số liệu báo cáo" bordered={false}>
                <Table
                  dataSource={data.rows.map((r) => ({ ...r.values, key: r.key }))}
                  columns={data.columns.map((col) => ({
                    title: col.label,
                    dataIndex: col.key,
                    key: col.key,
                    render: (val: unknown) => {
                      if (val === null || val === undefined) return "—";
                      if (col.type === "MONEY") return formatVnd(val as string);
                      if (col.type === "DATETIME") return formatDateTime(val as string);
                      return String(val);
                    },
                  }))}
                  pagination={{
                    current: data.meta.page,
                    pageSize: data.meta.limit,
                    total: data.meta.total,
                  }}
                />
              </Card>
            )}
          </>
        )}
      </ApiStateWrapper>
    </div>
  );
};
