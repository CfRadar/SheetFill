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
      return (
        <Chip
          size={size}
          color="success"
          variant="flat"
          startContent={<CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
          className={`font-semibold ${className}`}
        >
          {customLabel || "Ready"}
        </Chip>
      );

    case "needs_json":
      return (
        <Chip
          size={size}
          color="warning"
          variant="flat"
          startContent={<AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
          className={`font-semibold ${className}`}
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
          startContent={<AlertCircle className="w-3.5 h-3.5 shrink-0" />}
          className={`font-semibold ${className}`}
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
          startContent={<CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
          className={`font-semibold ${className}`}
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
          startContent={<Clock className="w-3.5 h-3.5 shrink-0" />}
          className={`font-semibold ${className}`}
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
          startContent={<Ban className="w-3.5 h-3.5 shrink-0" />}
          className={`font-semibold opacity-75 ${className}`}
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
          startContent={<Radio className="w-3.5 h-3.5 animate-pulse shrink-0" />}
          className={`font-semibold ${className}`}
        >
          {customLabel || "Online"}
        </Chip>
      );

    default:
      return (
        <Chip size={size} color="default" variant="flat" className={`font-semibold ${className}`}>
          {customLabel || status}
        </Chip>
      );
  }
};
