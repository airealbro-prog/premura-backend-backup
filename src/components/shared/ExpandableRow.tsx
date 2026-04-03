import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ExpandableRowProps {
  header: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export function ExpandableRow({ header, children, defaultExpanded = false }: ExpandableRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-border">
      <div
        className="flex items-center cursor-pointer hover:bg-muted/20 transition-colors duration-150"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="p-3 flex items-center justify-center">
          <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronRight size={16} className="text-muted-foreground" />
          </motion.div>
        </div>
        <div className="flex-1">{header}</div>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pl-10 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
