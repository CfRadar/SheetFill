import React, { useState } from "react";
import {
  Tabs,
  Tab,
  Card,
  CardBody,
  Button,
  Chip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import {
  Download,
  FileSpreadsheet,
  Layers,
  Sparkles,
  ExternalLink,
  Bot,
  Info,
} from "lucide-react";
import { TitleCard } from "./TitleCard";
import { KeywordSection } from "./KeywordSection";
import { DetailsAccordion } from "./DetailsAccordion";
import { RefineBox } from "./RefineBox";
import { exportPlatformToCSV, exportAllPlatformsToCSV } from "../lib/csv";
import type { RunResult, PlatformName, PlatformResult } from "../types";

interface Props {
  result: RunResult;
  briefSummary?: string;
}

const PLATFORM_ICONS: Record<PlatformName, string> = {
  amazon: "https://www.google.com/s2/favicons?domain=amazon.in&sz=32",
  flipkart: "https://www.google.com/s2/favicons?domain=flipkart.com&sz=32",
  myntra: "https://www.google.com/s2/favicons?domain=myntra.com&sz=32",
  meesho: "https://www.google.com/s2/favicons?domain=meesho.com&sz=32",
};

const PLATFORM_LABELS: Record<PlatformName, string> = {
  amazon: "Amazon",
  flipkart: "Flipkart",
  myntra: "Myntra",
  meesho: "Meesho",
};

export const ResultsPanel: React.FC<Props> = ({ result, briefSummary }) => {
  const platforms = result.platforms || [];
  const [selectedKey, setSelectedKey] = useState<string>(
    platforms[0]?.platform || "amazon"
  );

  const activePlatformResult: PlatformResult | undefined = platforms.find(
    (p) => p.platform === selectedKey
  );

  const handleExportCurrent = () => {
    if (!activePlatformResult) return;
    exportPlatformToCSV(activePlatformResult, result.run_id);
  };

  const handleExportAll = () => {
    exportAllPlatformsToCSV(platforms, result.run_id);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Target Market Summary Banner & Export Controls */}
      <Card className="border border-divider/70 bg-content1 shadow-xs">
        <CardBody className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Strategy & Optimized Titles Ready
              </h3>
              <Chip
                size="sm"
                variant="flat"
                color="primary"
                className="text-[10px] h-5 font-mono"
              >
                {result.llm_calls_used || 1} LLM call used
              </Chip>
            </div>
            {result.target_market_summary && (
              <p className="text-xs text-default-600 dark:text-default-300 leading-relaxed max-w-2xl">
                {result.target_market_summary}
              </p>
            )}
          </div>

          {/* Export Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  className="font-medium text-xs gap-1.5 h-8"
                  startContent={<Download className="w-3.5 h-3.5" />}
                >
                  Export CSV
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Export options">
                <DropdownItem
                  key="current"
                  textValue="Export Current Platform"
                  startContent={<FileSpreadsheet className="w-4 h-4 text-primary" />}
                  onPress={handleExportCurrent}
                >
                  Export {PLATFORM_LABELS[selectedKey as PlatformName]} CSV
                </DropdownItem>
                <DropdownItem
                  key="all"
                  textValue="Export All Platforms"
                  startContent={<Layers className="w-4 h-4 text-secondary" />}
                  onPress={handleExportAll}
                >
                  Export All Platforms ({platforms.length}) CSV
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </CardBody>
      </Card>

      {/* Platform Tabs */}
      <Tabs
        aria-label="Platform Results"
        selectedKey={selectedKey}
        onSelectionChange={(key) => setSelectedKey(String(key))}
        variant="underlined"
        classNames={{
          tabList: "gap-4 border-b border-divider/60 px-1",
          cursor: "w-full bg-primary",
          tab: "max-w-fit px-1 h-9",
          tabContent: "group-data-[selected=true]:text-primary font-semibold text-xs",
        }}
      >
        {platforms.map((p) => (
          <Tab
            key={p.platform}
            title={
              <div className="flex items-center gap-2">
                <img
                  src={PLATFORM_ICONS[p.platform]}
                  alt={p.platform}
                  className="w-3.5 h-3.5 rounded-xs"
                  onError={(e) => {
                    // Hide broken favicon image
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                <span>{PLATFORM_LABELS[p.platform]}</span>
                <span className="text-[10px] text-default-400 font-normal">
                  ({p.keywords?.length || 0} kw)
                </span>
              </div>
            }
          />
        ))}
      </Tabs>

      {/* Content for the Selected Platform */}
      {activePlatformResult && (
        <div className="flex flex-col gap-5">
          {/* Section 1: Deterministic Composed Titles */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                {PLATFORM_LABELS[activePlatformResult.platform]} Composed Titles
              </h4>
              <span className="text-[11px] text-default-400">
                Rule-composed according to {PLATFORM_LABELS[activePlatformResult.platform]} guidelines
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {activePlatformResult.titles && activePlatformResult.titles.length > 0 ? (
                activePlatformResult.titles.map((titleSug, idx) => (
                  <TitleCard
                    key={`${titleSug.style}-${idx}`}
                    suggestion={titleSug}
                    platform={activePlatformResult.platform}
                  />
                ))
              ) : (
                <div className="p-4 rounded-lg border border-dashed border-divider text-center text-xs text-default-400">
                  No titles generated for this platform.
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Scored Keywords */}
          <KeywordSection
            keywords={activePlatformResult.keywords || []}
            platformTitle={PLATFORM_LABELS[activePlatformResult.platform]}
          />

          {/* Section 3: Platform Details & Attributes to Fill */}
          <DetailsAccordion
            details={activePlatformResult.details}
            platform={activePlatformResult.platform}
          />

          {/* Section 4: Scraped Competitor Titles (if available) */}
          {activePlatformResult.top_scraped_titles &&
            activePlatformResult.top_scraped_titles.length > 0 && (
              <Card className="border border-divider/60 bg-content1 shadow-2xs">
                <CardBody className="p-4 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between pb-1 border-b border-divider/50">
                    <h5 className="text-xs font-semibold text-foreground">
                      Top Live Competitor Titles Scraped
                    </h5>
                    <span className="text-[10px] text-default-400">
                      Sample benchmark from live {PLATFORM_LABELS[activePlatformResult.platform]} search
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                    {activePlatformResult.top_scraped_titles.slice(0, 6).map((comp, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded bg-default-50/60 dark:bg-default-900/20 border border-divider/40 text-xs flex items-start justify-between gap-2"
                      >
                        <span className="font-mono text-[10px] text-default-400 shrink-0">
                          #{comp.rank || idx + 1}
                        </span>
                        <span className="text-foreground leading-snug flex-1">
                          {comp.title}
                        </span>
                        <span className="text-[10px] font-mono text-default-400 shrink-0">
                          {comp.length || comp.title.length}c
                        </span>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

          {/* Section 5: Interactive Refinement Box */}
          <RefineBox runId={result.run_id} />
        </div>
      )}
    </div>
  );
};
