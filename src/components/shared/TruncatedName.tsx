import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TruncatedNameProps {
  name: string;
  maxLen?: number;
  className?: string;
}

export function TruncatedName({ name, maxLen = 20, className }: TruncatedNameProps) {
  if (name.length <= maxLen) {
    return <span className={className}>{name}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className}>
          {name.slice(0, maxLen)}&hellip;
        </span>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
}
