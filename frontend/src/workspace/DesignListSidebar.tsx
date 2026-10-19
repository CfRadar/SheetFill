import React, { useState, useMemo, useEffect, useRef } from "react";
import { Tabs, Tab, Input } from "@heroui/react";
import { Search } from "lucide-react";
import { DetectedDesign } from "../types";
import { resolveDesignSizes } from "../utils/designUtils";

interface DesignListSidebarProps {
  designs: DetectedDesign[];
  activeDesignId: string;
  onSelectDesign: (id: string) => void;
  designSizes?: Record<string, string[]>;
}

export const DesignListSidebar: React.FC<DesignListSidebarProps> = ({
  designs,
  activeDesignId,
  onSelectDesign,
  designSizes = {},
}) => {
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  const readyCount = useMemo(
    () => designs.filter((d) => d.status === "ready" || d.status === "complete").length,
    [designs]
  );
  const needsJsonCount = designs.length - readyCount;

  const filteredDesigns = useMemo(() => {
    return designs.filter((d) => {
      // Status filter
      if (filter === "ready" && d.status !== "ready" && d.status !== "complete") {
        return false;
      }
      if (filter === "needs_json" && (d.status === "ready" || d.status === "complete")) {
        return false;
      }

      // Search filter
      if (search.trim()) {
        const query = search.toLowerCase();
        const baseMatch = (d.base || "").toLowerCase().includes(query);
        const rowMatch = d.sheet_rows.some((r) => String(r).includes(query));
        return baseMatch || rowMatch;
      }
      return true;
    });
  }, [designs, filter, search]);

  // Keep active item scrolled into view smoothly
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [activeDesignId]);

  // Arrow key navigation through designs list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();

    const currentIndex = filteredDesigns.findIndex((d) => d.id === activeDesignId);
    if (currentIndex === -1) return;

    if (e.key === "ArrowDown" && currentIndex < filteredDesigns.length - 1) {
      onSelectDesign(filteredDesigns[currentIndex + 1].id);
    } else if (e.key === "ArrowUp" && currentIndex > 0) {
      onSelectDesign(filteredDesigns[currentIndex - 1].id);
    }
  };

  const getStatusDot = (status: string) => {
    if (status === "ready" || status === "complete") {
      return (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shadow-xs" />
          <span className="hidden sm:inline">Ready</span>
        </span>
      );
    }
    if (status === "error") {
      return (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-500">
          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block shadow-xs" />
          <span className="hidden sm:inline">Error</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-amber-500">
        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block shadow-xs" />
        <span className="hidden sm:inline">Needs Info</span>
      </span>
    );
  };

  return (
    <aside
      className="w-full lg:w-80 flex-shrink-0 flex flex-col h-full bg-content1/80 backdrop-blur-md border-r border-divider/80 select-none"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label="Designs navigation sidebar"
    >
      {/* Sticky Top Controls: Filter Tabs & Search */}
      <div className="p-3 border-b border-divider/60 flex flex-col gap-2.5 sticky top-0 bg-content1/90 backdrop-blur-md z-10">
        <Tabs
          selectedKey={filter}
          onSelectionChange={(k) => setFilter(String(k))}
          size="sm"
          variant="underlined"
          color="primary"
          aria-label="Filter designs by status"
          classNames={{
            tabList: "w-full justify-between gap-1 p-0 border-b border-divider/60",
            cursor: "w-full bg-primary",
            tab: "px-2 h-8 text-xs font-semibold",
            tabContent: "group-data-[selected=true]:font-bold",
          }}
        >
          <Tab
            key="all"
            title={
              <div className="flex items-center gap-1.5">
                <span>All</span>
                <span className="text-[11px] text-default-400 font-mono">({designs.length})</span>
              </div>
            }
          />
          <Tab
            key="needs_json"
            title={
              <div className="flex items-center gap-1.5">
                <span>Needs Info</span>
                <span className="text-[11px] text-default-400 font-mono">({needsJsonCount})</span>
              </div>
            }
          />
          <Tab
            key="ready"
            title={
              <div className="flex items-center gap-1.5">
                <span>Ready</span>
                <span className="text-[11px] text-default-400 font-mono">({readyCount})</span>
              </div>
            }
          />
        </Tabs>

        {designs.length > 3 && (
          <Input
            size="sm"
            placeholder="Search designs or rows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            variant="bordered"
            startContent={<Search className="w-3.5 h-3.5 text-default-400 shrink-0 ml-1 mr-1" />}
            isClearable
            onClear={() => setSearch("")}
            className="w-full"
            classNames={{
              inputWrapper: "h-8 rounded-xl border-divider bg-content2/60",
              input: "text-xs font-medium",
            }}
            aria-label="Search designs"
          />
        )}
      </div>

      {/* Scrollable Designs List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 focus:outline-none">
        {filteredDesigns.length === 0 ? (
          <div className="py-12 text-center text-xs text-default-400">
            No designs match this filter
          </div>
        ) : (
          filteredDesigns.map((design) => {
            const isActive = design.id === activeDesignId;
            const globalIndex = designs.findIndex((d) => d.id === design.id);
            const sizes = resolveDesignSizes(designSizes?.[design.id], design.sizes_found || []);
            const rowsStr =
              design.sheet_rows.length > 1
                ? `Rows ${design.sheet_rows[0]}–${design.sheet_rows[design.sheet_rows.length - 1]}`
                : design.sheet_rows.length === 1
                ? `Row ${design.sheet_rows[0]}`
                : "slot";

            return (
              <button
                key={design.id}
                ref={isActive ? activeItemRef : null}
                type="button"
                onClick={() => onSelectDesign(design.id)}
                className={`w-full text-left p-2.5 rounded-xl border transition-all duration-150 flex items-center justify-between gap-3 focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                  isActive
                    ? "bg-primary-50/80 dark:bg-primary-950/40 border-primary/50 shadow-xs"
                    : "bg-content2/30 hover:bg-content2/80 border-divider/50 text-default-700"
                }`}
                aria-selected={isActive}
              >
                {/* Larger 40x40 Thumbnail & Title */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-content3 border border-divider/80 overflow-hidden flex-shrink-0 flex items-center justify-center text-xs font-bold text-default-400 shadow-2xs">
                    {design.main_image_url ? (
                      <img
                        src={design.main_image_url}
                        alt=""
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      `#${globalIndex + 1}`
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate">
                      <span className="text-xs font-bold text-foreground truncate block">
                        #{globalIndex + 1} {design.base || "Unnamed design"}
                      </span>
                    </div>
                    <div className="text-[11px] text-default-400 mt-0.5 truncate flex items-center gap-1.5 font-medium">
                      <span>{sizes.length} sizes</span>
                      <span>·</span>
                      <span className="font-mono text-[10px]">{rowsStr}</span>
                    </div>
                  </div>
                </div>

                {/* Clean Status Dot */}
                <div className="shrink-0">
                  {getStatusDot(design.status)}
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};
