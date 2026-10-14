import React, { useState, useMemo, useEffect, useRef } from "react";
import { Tabs, Tab, Input } from "@heroui/react";
import { Search } from "lucide-react";
import { DetectedDesign } from "../types";
import { StatusChip } from "../ui/StatusChip";

interface DesignListSidebarProps {
  designs: DetectedDesign[];
  activeDesignId: string;
  onSelectDesign: (id: string) => void;
  designSizes: Record<string, string[]>;
}

export const DesignListSidebar: React.FC<DesignListSidebarProps> = ({
  designs,
  activeDesignId,
  onSelectDesign,
  designSizes,
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

  return (
    <aside
      className="w-full lg:w-80 flex-shrink-0 flex flex-col h-full bg-content1 border-r border-divider select-none"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label="Designs navigation sidebar"
    >
      {/* Top Controls: Filter Tabs & Search */}
      <div className="p-3 border-b border-divider flex flex-col gap-2.5">
        <Tabs
          selectedKey={filter}
          onSelectionChange={(k) => setFilter(String(k))}
          size="sm"
          variant="underlined"
          color="primary"
          aria-label="Filter designs by status"
          classNames={{
            tabList: "w-full justify-between gap-0 p-0 border-b border-transparent",
            cursor: "w-full bg-primary",
            tab: "max-w-fit px-2 h-8 text-xs font-medium",
            tabContent: "group-data-[selected=true]:font-bold",
          }}
        >
          <Tab key="all" title={`All (${designs.length})`} />
          <Tab key="needs_json" title={`Needs JSON (${needsJsonCount})`} />
          <Tab key="ready" title={`Ready (${readyCount})`} />
        </Tabs>

        {designs.length > 5 && (
          <Input
            size="sm"
            placeholder="Search designs or rows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            startContent={<Search className="w-3.5 h-3.5 text-default-400" />}
            isClearable
            onClear={() => setSearch("")}
            className="w-full"
            aria-label="Search designs"
          />
        )}
      </div>

      {/* Scrollable Designs List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 focus:outline-none">
        {filteredDesigns.length === 0 ? (
          <div className="py-8 text-center text-xs text-default-400">
            No designs match this filter
          </div>
        ) : (
          filteredDesigns.map((design) => {
            const isActive = design.id === activeDesignId;
            const globalIndex = designs.findIndex((d) => d.id === design.id);
            const sizes = designSizes[design.id] || design.sizes_found || ["S", "M", "L", "XL"];
            const rowsStr =
              design.sheet_rows.length > 1
                ? `r${design.sheet_rows[0]}..${design.sheet_rows[design.sheet_rows.length - 1]}`
                : design.sheet_rows.length === 1
                ? `r${design.sheet_rows[0]}`
                : "slot";

            return (
              <button
                key={design.id}
                ref={isActive ? activeItemRef : null}
                type="button"
                onClick={() => onSelectDesign(design.id)}
                className={`w-full text-left p-2.5 rounded-xl border transition-all duration-150 flex items-center justify-between gap-2.5 focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                  isActive
                    ? "bg-primary-50/80 dark:bg-primary-950/40 border-primary-400 dark:border-primary-600 shadow-xs"
                    : "bg-content2/40 hover:bg-content2/80 border-transparent text-default-700"
                }`}
                aria-selected={isActive}
              >
                {/* Thumbnail & Title */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg bg-default-100 border border-divider overflow-hidden flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-default-400">
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
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-xs font-semibold text-foreground truncate">
                        #{globalIndex + 1} {design.base || "Unnamed stub"}
                      </span>
                    </div>
                    <div className="text-[11px] text-default-400 mt-0.5 truncate flex items-center gap-1.5">
                      <span>{sizes.length} sizes</span>
                      <span>•</span>
                      <span className="font-mono">{rowsStr}</span>
                    </div>
                  </div>
                </div>

                {/* Status chip */}
                <div className="shrink-0">
                  <StatusChip status={design.status} size="sm" />
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};
