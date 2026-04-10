import { motion } from "framer-motion";
import { Construction } from "lucide-react";

interface PlaceholderViewProps {
  title: string;
  description?: string;
}

export function PlaceholderView({ title, description }: PlaceholderViewProps) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Construction size={48} className="text-muted-foreground/40" />
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground max-w-md text-center">
          {description || "This section is under development. Data and features will appear here once configured."}
        </p>
      </div>
    </motion.div>
  );
}
