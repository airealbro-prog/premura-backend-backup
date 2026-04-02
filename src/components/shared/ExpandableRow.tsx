import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

interface ExpandableRowProps {
  header: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export function ExpandableRow({ header, children, defaultExpanded = false }: ExpandableRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-border-subtle">
      <div
        className="flex items-center cursor-pointer hover:bg-white/[0.02] transition-colors duration-200"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="p-3 flex items-center justify-center">
          <ChevronRight
            size={16}
            className="text-text-secondary transition-transform duration-300 ease-in-out"
            style={{
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            }}
          />
        </div>
        <div className="flex-1">{header}</div>
      </div>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: expanded ? "2000px" : "0",
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="pl-10 pb-3">{children}</div>
      </div>
    </div>
  );
}
