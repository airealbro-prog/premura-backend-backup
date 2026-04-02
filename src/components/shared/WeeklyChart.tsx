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
        <Bar
          dataKey="appointments"
          fill="url(#barGradient)"
          radius={[4, 4, 0, 0]}
        />
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7b2ff7" />
            <stop offset="100%" stopColor="#00d4ff" />
          </linearGradient>
        </defs>
      </BarChart>
    </ResponsiveContainer>
  );
}
