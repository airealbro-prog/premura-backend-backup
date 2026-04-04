import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface MonthlyChartProps {
  data: { label: string; appointments: number }[];
  height?: number;
}

export function MonthlyChart({ data, height = 250 }: MonthlyChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="label"
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "#111827",
            border: "1px solid #1f2937",
            borderRadius: "8px",
            color: "#f9fafb",
            fontSize: 13,
          }}
        />
        <Line
          type="monotone"
          dataKey="appointments"
          stroke="#8851F4"
          strokeWidth={2}
          dot={{ fill: "#6b3cc7", stroke: "#8851F4", strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, fill: "#8851F4" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
