import React from "react";
import { Button } from "@heroui/react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 ${className}`}
    >
      {icon && (
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 mb-4 shadow-sm">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button color="primary" variant="flat" size="sm" onPress={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
