import React from "react";
import { Chip } from "@heroui/react";
import { CheckCircle2, AlertTriangle, AlertCircle, Clock, Ban, Radio } from "lucide-react";

export type StatusType =
  | "ready"
  | "needs_json"
  | "invalid"
  | "error"
  | "active"
  | "expired"
  | "disabled"
  | "online";

interface StatusChipProps {
  status: StatusType | string;
  size?: "sm" | "md";
  className?: string;
  customLabel?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  size = "sm",
  className = "",
  customLabel,
}) => {
  const norm = status.toLowerCase();

  switch (norm) {
    case "ready":
    case "complete":
      return (
        <Chip
          size={size}
          color="success"
          variant="flat"
          startContent={<CheckCircle2 className="w-3.5 h-3.5 shrink-0 ml-0.5" />}
          className={`h-6 text-[12px] font-medium px-2 py-0.5 border border-success-200 dark:border-success-900/40 ${className}`}
        >
          {customLabel || (norm === "complete" ? "Complete" : "Ready")}
        </Chip>
      );

    case "partial":
      return (
        <Chip
          size={size}
          color="warning"
          variant="flat"
          startContent={<Clock className="w-3.5 h-3.5 shrink-0 ml-0.5" />}
          className={`h-6 text-[12px] font-medium px-2 py-0.5 border border-warning-200 dark:border-warning-900/40 ${className}`}
        >
          {customLabel || "Partial"}
        </Chip>
      );

    case "needs_json":
      return (
        <Chip
          size={size}
          color="warning"
          variant="flat"
          startContent={<AlertTriangle className="w-3.5 h-3.5 shrink-0 ml-0.5" />}
          className={`h-6 text-[12px] font-medium px-2 py-0.5 border border-warning-200 dark:border-warning-900/40 ${className}`}
        >
          {customLabel || "Needs JSON"}
        </Chip>
      );

    case "invalid":
    case "error":
      return (
        <Chip
          size={size}
          color="danger"
          variant="flat"
          startContent={<AlertCircle className="w-3.5 h-3.5 shrink-0 ml-0.5" />}
          className={`h-6 text-[12px] font-medium px-2 py-0.5 border border-danger-200 dark:border-danger-900/40 ${className}`}
        >
          {customLabel || "Error"}
        </Chip>
      );

    case "active":
      return (
        <Chip
          size={size}
          color="success"
          variant="flat"
          startContent={<CheckCircle2 className="w-3.5 h-3.5 shrink-0 ml-0.5" />}
          className={`h-6 text-[12px] font-medium px-2 py-0.5 border border-success-200 dark:border-success-900/40 ${className}`}
        >
          {customLabel || "Active"}
        </Chip>
      );

    case "expired":
      return (
        <Chip
          size={size}
          color="danger"
          variant="flat"
          startContent={<Clock className="w-3.5 h-3.5 shrink-0 ml-0.5" />}
          className={`h-6 text-[12px] font-medium px-2 py-0.5 border border-danger-200 dark:border-danger-900/40 ${className}`}
        >
          {customLabel || "Expired"}
        </Chip>
      );

    case "disabled":
      return (
        <Chip
          size={size}
          color="default"
          variant="flat"
          startContent={<Ban className="w-3.5 h-3.5 shrink-0 ml-0.5" />}
          className={`h-6 text-[12px] font-medium px-2 py-0.5 opacity-75 border border-divider ${className}`}
        >
          {customLabel || "Disabled"}
        </Chip>
      );

    case "online":
      return (
        <Chip
          size={size}
          color="success"
          variant="dot"
          startContent={<Radio className="w-3.5 h-3.5 animate-pulse shrink-0 ml-0.5" />}
          className={`h-6 text-[12px] font-medium px-2 py-0.5 ${className}`}
        >
          {customLabel || "Online"}
        </Chip>
      );

    default:
      return (
        <Chip
          size={size}
          color="default"
          variant="flat"
          className={`h-6 text-[12px] font-medium px-2 py-0.5 border border-divider ${className}`}
        >
          {customLabel || status}
        </Chip>
      );
  }
};
