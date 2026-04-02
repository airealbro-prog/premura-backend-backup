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
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="label"
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "#0f3460",
            border: "1px solid rgba(0,212,255,0.3)",
            borderRadius: "8px",
            color: "#e2e8f0",
            fontSize: 13,
          }}
        />
        <Line
          type="monotone"
          dataKey="appointments"
          stroke="#00d4ff"
          strokeWidth={2}
          dot={{ fill: "#7b2ff7", stroke: "#00d4ff", strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, fill: "#00d4ff" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
