import React from "react";
import { Card, Col, Empty, Row, Typography } from "antd";
import type { ReportSeries } from "@halora/api-client";
import { formatVnd } from "../../utils/format";

const { Text } = Typography;

export function formatReportValue(value: string, unit: string): string {
  if (unit === "VND") return formatVnd(value);
  return new Intl.NumberFormat("vi-VN").format(Number(value) || 0);
}

interface BarChartProps {
  series: ReportSeries;
}

const BarChart: React.FC<BarChartProps> = ({ series }) => {
  const points = series.points;
  if (!points.length) {
    return <Empty description="Chưa có dữ liệu cho kỳ báo cáo này" />;
  }

  const padding = { top: 18, right: 12, bottom: 34, left: 12 };
  const width = Math.max(360, points.length * 58);
  const height = 240;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const slot = plotWidth / points.length;
  const barWidth = Math.max(10, slot * 0.62);
  const max = Math.max(1, ...points.map((point) => Number(point.value) || 0));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={series.name}
      style={{ width: "100%", height: 240, display: "block" }}
    >
      <line
        x1={padding.left}
        y1={padding.top + plotHeight}
        x2={width - padding.right}
        y2={padding.top + plotHeight}
        stroke="#e8e8e8"
      />
      {points.map((point, index) => {
        const value = Number(point.value) || 0;
        const barHeight = (value / max) * plotHeight;
        const x = padding.left + index * slot + (slot - barWidth) / 2;
        const y = padding.top + plotHeight - barHeight;
        const label = point.period.length >= 7 ? point.period.slice(5) : point.period;
        return (
          <g key={`${series.key}-${point.period}`}>
            <title>{`${point.period}: ${formatReportValue(point.value, series.unit)}`}</title>
            <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, value > 0 ? 2 : 0)} rx={4} fill="#c05c74" />
            <text
              x={x + barWidth / 2}
              y={height - 14}
              textAnchor="middle"
              fontSize={points.length > 12 ? 10 : 11}
              fill="#8c8c8c"
            >
              {label}
            </text>
          </g>
        );
      })}
      <text x={padding.left} y={12} fontSize={11} fill="#8c8c8c">
        Cao nhất: {formatReportValue(String(max), series.unit)}
      </text>
    </svg>
  );
};

interface ReportSeriesChartsProps {
  series: ReportSeries[];
}

export const ReportSeriesCharts: React.FC<ReportSeriesChartsProps> = ({ series }) => {
  if (!series.length) {
    return <Empty description="Chưa có dữ liệu biểu đồ cho kỳ báo cáo này" />;
  }

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      {series.map((item) => (
        <Col xs={24} lg={12} key={item.key}>
          <Card
            title={item.name}
            size="small"
            bordered={false}
            style={{ background: "#fafafa" }}
            extra={<Text type="secondary">{item.unit === "VND" ? "VNĐ" : item.unit === "QUANTITY" ? "Số lượng" : "Lượt"}</Text>}
          >
            <BarChart series={item} />
          </Card>
        </Col>
      ))}
    </Row>
  );
};
