import React, { useState } from "react";
import { Chip, Card, CardBody, Button } from "@heroui/react";
import {
  IndianRupee,
  Tag,
  AlertOctagon,
  TrendingUp,
  CheckSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { PlatformDetails, PlatformName } from "../types";

interface Props {
  details?: PlatformDetails;
  platform: PlatformName;
}

export const DetailsAccordion: React.FC<Props> = ({ details, platform }) => {
  const [isAttributesOpen, setIsAttributesOpen] = useState(true);
  const [isNegativeOpen, setIsNegativeOpen] = useState(true);
  const [isInsightsOpen, setIsInsightsOpen] = useState(true);

  if (!details) return null;

  const hasAttributes = Boolean(details.attributes_to_fill && details.attributes_to_fill.length > 0);
  const hasNegative = Boolean(details.negative_keywords && details.negative_keywords.length > 0);
  const hasTags = Boolean(details.hashtags_or_tags && details.hashtags_or_tags.length > 0);
  const hasNotes = Boolean(
    details.competition_note || details.seasonality_note || details.price_band || details.notes
  );

  if (!hasAttributes && !hasNegative && !hasTags && !hasNotes) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 1. Recommended Attributes to Fill */}
      {hasAttributes && (
        <Card className="border border-divider/70 bg-content1 shadow-2xs">
          <CardBody className="p-3.5 flex flex-col gap-2">
            <button
              type="button"
              className="flex items-center justify-between text-left focus:outline-none"
              onClick={() => setIsAttributesOpen(!isAttributesOpen)}
            >
              <div className="flex items-center gap-2">
                <CheckSquare className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  Recommended Listing Attributes ({details.attributes_to_fill!.length})
                </span>
                <span className="text-[11px] text-default-400 hidden sm:inline">
                  • Essential catalog indexing fields
                </span>
              </div>
              {isAttributesOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-default-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-default-400" />
              )}
            </button>

            {isAttributesOpen && (
              <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-divider/50">
                {details.attributes_to_fill!.map((attr, idx) => (
                  <Chip
                    key={idx}
                    size="sm"
                    variant="flat"
                    className="text-[11px] bg-default-100 text-default-700 dark:bg-default-800"
                  >
                    {attr}
                  </Chip>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* 2. Negative Keywords */}
      {hasNegative && (
        <Card className="border border-danger-200/60 dark:border-danger-900/40 bg-danger-50/20 dark:bg-danger-950/10 shadow-2xs">
          <CardBody className="p-3.5 flex flex-col gap-2">
            <button
              type="button"
              className="flex items-center justify-between text-left focus:outline-none"
              onClick={() => setIsNegativeOpen(!isNegativeOpen)}
            >
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-3.5 h-3.5 text-danger" />
                <span className="text-xs font-semibold text-danger">
                  Negative Keywords to Exclude ({details.negative_keywords!.length})
                </span>
                <span className="text-[11px] text-danger-400 hidden sm:inline">
                  • Prevents wasted ad spend & listing suppression
                </span>
              </div>
              {isNegativeOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-danger-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-danger-400" />
              )}
            </button>

            {isNegativeOpen && (
              <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-danger-200/40">
                {details.negative_keywords!.map((neg, idx) => (
                  <Chip
                    key={idx}
                    size="sm"
                    variant="flat"
                    color="danger"
                    className="text-[11px] font-mono"
                  >
                    {neg}
                  </Chip>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* 3. Pricing, Insights & Search Tags */}
      {(hasNotes || hasTags) && (
        <Card className="border border-divider/70 bg-content1 shadow-2xs">
          <CardBody className="p-3.5 flex flex-col gap-2">
            <button
              type="button"
              className="flex items-center justify-between text-left focus:outline-none"
              onClick={() => setIsInsightsOpen(!isInsightsOpen)}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-secondary" />
                <span className="text-xs font-semibold text-foreground">
                  Pricing, Competition & Market Insights
                </span>
              </div>
              {isInsightsOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-default-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-default-400" />
              )}
            </button>

            {isInsightsOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-divider/50 text-xs">
                {details.price_band && (
                  <div className="p-2.5 rounded bg-default-50 dark:bg-default-900/30 border border-divider flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-[11px] font-medium text-default-500">
                      <IndianRupee className="w-3 h-3 text-success" />
                      <span>Optimal Price Band</span>
                    </div>
                    <span className="font-semibold text-foreground">{details.price_band}</span>
                  </div>
                )}

                {details.competition_note && (
                  <div className="p-2.5 rounded bg-default-50 dark:bg-default-900/30 border border-divider flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-default-500">Competition Density</span>
                    <span className="text-default-700 dark:text-default-300 leading-snug">
                      {details.competition_note}
                    </span>
                  </div>
                )}

                {details.seasonality_note && (
                  <div className="p-2.5 rounded bg-default-50 dark:bg-default-900/30 border border-divider flex flex-col gap-1 sm:col-span-2">
                    <span className="text-[11px] font-medium text-default-500">Seasonality & Buyer Timing</span>
                    <span className="text-default-700 dark:text-default-300 leading-snug">
                      {details.seasonality_note}
                    </span>
                  </div>
                )}

                {details.notes && (
                  <div className="p-2.5 rounded bg-default-50 dark:bg-default-900/30 border border-divider flex flex-col gap-1 sm:col-span-2">
                    <span className="text-[11px] font-medium text-default-500">Platform Notes</span>
                    <span className="text-default-700 dark:text-default-300 leading-snug">
                      {details.notes}
                    </span>
                  </div>
                )}

                {hasTags && (
                  <div className="p-2.5 rounded bg-default-50 dark:bg-default-900/30 border border-divider flex flex-col gap-1.5 sm:col-span-2">
                    <div className="flex items-center gap-1 text-[11px] font-medium text-default-500">
                      <Tag className="w-3 h-3 text-warning" />
                      <span>Recommended Search Tags ({details.hashtags_or_tags!.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {details.hashtags_or_tags!.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] px-2 py-0.5 rounded bg-default-100 dark:bg-default-800 text-default-600 dark:text-default-300 font-mono"
                        >
                          #{tag.replace(/^#/, "")}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
};
