import React from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Chip,
} from "@heroui/react";
import { Star, ExternalLink, ShieldCheck, Tag, Hash, FileSpreadsheet } from "lucide-react";
import type { CompetitorTitle, PlatformName } from "../types";

interface CompetitorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  competitor: CompetitorTitle | null;
  platform: PlatformName;
}

export const CompetitorDrawer: React.FC<CompetitorDrawerProps> = ({
  isOpen,
  onClose,
  competitor,
  platform,
}) => {
  if (!competitor) return null;

  const platformSearchUrls: Record<PlatformName, string> = {
    amazon: `https://www.amazon.in/s?k=${encodeURIComponent(competitor.title)}`,
    flipkart: `https://www.flipkart.com/search?q=${encodeURIComponent(competitor.title)}`,
    myntra: `https://www.myntra.com/${encodeURIComponent(competitor.title)}`,
    meesho: `https://www.meesho.com/search?q=${encodeURIComponent(competitor.title)}`,
  };

  const searchUrl = platformSearchUrls[platform] || platformSearchUrls.flipkart;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" scrollBehavior="inside">
      <ModalContent className="bg-content1 text-foreground border border-divider rounded-2xl shadow-2xl">
        <ModalHeader className="flex items-center justify-between border-b border-divider py-3.5 px-6">
          <div className="flex items-center gap-2">
            <Chip size="sm" variant="flat" color="primary" className="text-xs font-bold uppercase">
              {platform} #{competitor.rank}
            </Chip>
            <span className="text-sm font-semibold text-foreground">Competitor Deep-Dive</span>
          </div>
        </ModalHeader>

        <ModalBody className="py-5 px-6 space-y-4">
          {/* Full Title */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-default-500 uppercase tracking-wider">
              Scraped Product Title
            </span>
            <div className="p-3.5 rounded-xl bg-content2/70 border border-divider text-xs text-foreground font-medium leading-relaxed">
              {competitor.title}
            </div>
            <div className="flex items-center justify-between text-[11px] text-default-400 px-1">
              <span>Title Length</span>
              <span className="font-mono font-semibold text-foreground">
                {competitor.length || competitor.title.length} characters
              </span>
            </div>
          </div>

          {/* Rating & Volume Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-default-50/60 border border-divider flex flex-col gap-1">
              <span className="text-[11px] text-default-400 font-medium">Customer Rating</span>
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="text-base font-bold text-foreground">
                  {competitor.rating ? competitor.rating.toFixed(1) : "Unrated"}
                </span>
                <span className="text-xs text-default-400">/ 5.0</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-default-50/60 border border-divider flex flex-col gap-1">
              <span className="text-[11px] text-default-400 font-medium">Total Reviews</span>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-foreground">
                  {competitor.rating_count ? competitor.rating_count.toLocaleString() : "N/A"}
                </span>
                <span className="text-xs text-default-400">ratings</span>
              </div>
            </div>
          </div>

          {/* Brand & Price Attributes */}
          <div className="p-3.5 rounded-xl border border-divider bg-content2/40 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-default-400 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-primary" /> Brand
              </span>
              <span className="font-semibold text-foreground">
                {competitor.brand || "Generic / Unbranded"}
              </span>
            </div>

            {competitor.price && (
              <div className="flex items-center justify-between text-xs pt-2 border-t border-divider/60">
                <span className="text-default-400 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-emerald-500" /> Listed Price
                </span>
                <span className="font-semibold text-emerald-500 font-mono">
                  {typeof competitor.price === "number" ? `₹${competitor.price}` : competitor.price}
                </span>
              </div>
            )}
          </div>

          {/* Bayesian Ranking Note */}
          <div className="p-3 rounded-xl bg-primary-50/50 dark:bg-primary-950/20 border border-primary-200 dark:border-primary-800 text-[11px] text-default-600 dark:text-default-300 leading-relaxed">
            <span className="font-semibold text-primary">Bayesian Weighted Score: </span>
            This listing is ranked using m-estimate damping (prior m=10, global average C=4.0) to prioritize high-volume verified customer satisfaction over sparse 5-star items.
          </div>
        </ModalBody>

        <ModalFooter className="border-t border-divider py-3 px-6 flex items-center justify-between">
          <Button
            size="sm"
            variant="flat"
            color="primary"
            as="a"
            href={searchUrl}
            target="_blank"
            rel="noreferrer"
            startContent={<ExternalLink className="w-3.5 h-3.5" />}
            className="rounded-xl font-medium text-xs"
          >
            Search on {platform}
          </Button>

          <Button size="sm" variant="light" onPress={onClose} className="rounded-xl">
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
