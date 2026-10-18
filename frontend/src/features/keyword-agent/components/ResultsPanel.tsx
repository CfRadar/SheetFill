import React, { useState } from "react";
import {
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
  ChevronRight,
  Star,
} from "lucide-react";
import { TitleCard } from "./TitleCard";
import { KeywordSection } from "./KeywordSection";
import { DetailsAccordion } from "./DetailsAccordion";
import { RefineBox } from "./RefineBox";
import { PlatformTreemap } from "./PlatformTreemap";
import { RatingDistributionBar } from "./RatingDistributionBar";
import { CompetitorDrawer } from "./CompetitorDrawer";
import { exportPlatformToCSV, exportAllPlatformsToCSV } from "../lib/csv";
import type { RunResult, PlatformName, PlatformResult, CompetitorTitle } from "../types";

interface Props {
  result: RunResult;
  briefSummary?: string;
}

const PLATFORM_LABELS: Record<PlatformName, string> = {
  amazon: "Amazon",
  flipkart: "Flipkart",
  myntra: "Myntra",
  meesho: "Meesho",
};

export const ResultsPanel: React.FC<Props> = ({ result, briefSummary }) => {
  const platforms = result.platforms || [];
  const [selectedKey, setSelectedKey] = useState<PlatformName>(
    platforms[0]?.platform || "flipkart"
  );
  const [activeCompetitor, setActiveCompetitor] = useState<CompetitorTitle | null>(null);

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
    <div className="w-full xl:h-[calc(100vh-140px)] flex flex-col xl:overflow-hidden gap-3">
      {/* Top Bar: Market Summary Banner & Export Controls */}
      <div className="p-3.5 sm:p-4 rounded-2xl border border-divider/80 bg-content1/90 backdrop-blur-md shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-bold text-foreground">
              Market Intelligence & Strategy Dashboard
            </h3>
            <Chip
              size="sm"
              variant="flat"
              color="primary"
              className="text-[10px] h-5 font-mono font-semibold"
            >
              {result.llm_calls_used || 1} LLM calls
            </Chip>
          </div>
          {result.target_market_summary && (
            <p className="text-xs text-default-500 leading-relaxed max-w-3xl truncate">
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
                className="font-semibold text-xs gap-1.5 h-8 px-3 rounded-xl"
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
                Export {PLATFORM_LABELS[selectedKey]} CSV
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
      </div>

      {/* Main Single-Viewport 2-Column Grid for Desktop */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 flex-1 xl:min-h-0">
        {/* Left Column: Visual Analytics & Refinement (5/12 width) */}
        <div className="xl:col-span-5 flex flex-col gap-3.5 xl:h-full xl:overflow-y-auto pr-0.5">
          {/* Platform Treemap */}
          <div className="p-3.5 rounded-2xl border border-divider/80 bg-content1/80 backdrop-blur-sm shrink-0">
            <PlatformTreemap
              platforms={platforms}
              activePlatform={selectedKey}
              onSelectPlatform={setSelectedKey}
            />
          </div>

          {/* Rating Distribution Bar */}
          {activePlatformResult && (
            <div className="shrink-0">
              <RatingDistributionBar
                competitors={activePlatformResult.top_scraped_titles || []}
                platform={selectedKey}
              />
            </div>
          )}

          {/* Interactive Chat Refinement Box */}
          <div className="shrink-0">
            <RefineBox runId={result.run_id} />
          </div>
        </div>

        {/* Right Column: Titles, Keywords, Competitors, Platform Attributes (7/12 width, Scrollable) */}
        <div className="xl:col-span-7 xl:h-full xl:overflow-y-auto flex flex-col gap-4 pr-1">
          {activePlatformResult && (
            <>
              {/* Section 1: Deterministic Composed Titles */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    {PLATFORM_LABELS[activePlatformResult.platform]} Optimized Titles
                  </h4>
                  <span className="text-[11px] text-default-400">
                    Compliant with {PLATFORM_LABELS[activePlatformResult.platform]} title guidelines
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
                    <div className="p-4 rounded-xl border border-dashed border-divider text-center text-xs text-default-400">
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

              {/* Section 3: Live Scraped Competitors list */}
              <div className="rounded-2xl border border-divider/80 bg-content1/80 backdrop-blur-sm p-4 flex flex-col gap-2.5 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-divider/60">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Top Scraped Competitors
                    </h4>
                    <span className="text-[11px] font-mono text-default-400 font-semibold px-1.5 py-0.5 rounded-md bg-content2">
                      {activePlatformResult?.top_scraped_titles?.length || 0}
                    </span>
                  </div>
                  <span className="text-[11px] text-default-400">
                    Click listing to inspect details & keywords
                  </span>
                </div>

                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {activePlatformResult?.top_scraped_titles &&
                  activePlatformResult.top_scraped_titles.length > 0 ? (
                    activePlatformResult.top_scraped_titles.map((comp, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveCompetitor(comp)}
                        className="w-full p-2.5 rounded-xl bg-content2/50 hover:bg-content2/90 border border-divider/60 text-left transition-all flex items-center justify-between gap-3 group select-none cursor-pointer"
                      >
                        <span className="font-mono text-[10px] text-default-400 font-bold shrink-0">
                          #{comp.rank || idx + 1}
                        </span>
                        <span className="text-xs text-foreground group-hover:text-primary transition-colors flex-1 line-clamp-1 leading-snug">
                          {comp.title}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {comp.rating ? (
                            <span className="flex items-center gap-1 text-[11px] text-amber-500 font-semibold bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {comp.rating.toFixed(1)}
                            </span>
                          ) : null}
                          <ChevronRight className="w-3.5 h-3.5 text-default-400 group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-default-400">
                      No competitor titles available for this platform.
                    </div>
                  )}
                </div>
              </div>

              {/* Section 4: Platform Details & Attributes to Fill */}
              <DetailsAccordion
                details={activePlatformResult.details}
                platform={activePlatformResult.platform}
              />
            </>
          )}
        </div>
      </div>

      {/* Slide-in Competitor Deep-Dive Drawer */}
      <CompetitorDrawer
        isOpen={Boolean(activeCompetitor)}
        onClose={() => setActiveCompetitor(null)}
        competitor={activeCompetitor}
        platform={selectedKey}
      />
    </div>
  );
};
