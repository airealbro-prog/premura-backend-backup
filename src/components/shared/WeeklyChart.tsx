import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface WeeklyChartProps {
  data: { label: string; appointments: number }[];
  height?: number;
}

export function WeeklyChart({ data, height = 250 }: WeeklyChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
        <Bar dataKey="appointments" fill="#8851F4" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
