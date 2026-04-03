import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  accentColor?: string;
}

export function StatCard({ label, value, icon, accentColor }: StatCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.15 }}
      className="glass-card p-5 flex flex-col gap-2 min-w-[180px]"
    >
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          {label}
        </span>
        {icon && (
          <span className="w-8 h-8 rounded-md flex items-center justify-center bg-primary/10">
            {icon}
          </span>
        )}
      </div>
      <span
        className="text-3xl font-bold tabular-nums tracking-tight"
        style={{ color: accentColor ?? "#f9fafb" }}
      >
        {value}
      </span>
    </motion.div>
  );
}
