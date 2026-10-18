import React, { useState } from "react";
import {
  Button,
  Input,
  Textarea,
  Chip,
  Accordion,
  AccordionItem,
} from "@heroui/react";
import { Sparkles, SlidersHorizontal, Compass, Check } from "lucide-react";
import { PlatformPicker } from "./PlatformPicker";
import type { ProductBrief, PlatformName } from "../types";

interface Props {
  brief: ProductBrief;
  onChange: (next: ProductBrief) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isKeyConfigured: boolean;
  onOpenKeyModal: () => void;
}

const TSHIRT_TYPES = [
  "Round Neck T-Shirt",
  "Oversized T-Shirt",
  "Polo T-Shirt",
  "Graphic Printed T-Shirt",
  "Drop Shoulder T-Shirt",
  "Henley T-Shirt",
  "Sleeveless Tank",
];

const COLOR_SWATCHES: { name: string; hex: string; isLight?: boolean }[] = [
  { name: "Black", hex: "#111827" },
  { name: "White", hex: "#FFFFFF", isLight: true },
  { name: "Navy Blue", hex: "#1E3A8A" },
  { name: "Olive Green", hex: "#3F6212" },
  { name: "Beige", hex: "#D4C5B9" },
  { name: "Maroon", hex: "#831843" },
  { name: "Grey Melange", hex: "#9CA3AF" },
  { name: "Lavender", hex: "#C084FC" },
];

const GENDERS: Array<ProductBrief["gender"]> = ["men", "women", "unisex", "kids"];

const FITS = ["Regular", "Oversized", "Slim Fit", "Boxy Fit", "Relaxed Fit"];
const FABRICS = ["100% Cotton", "Cotton Blend", "Bio-washed Cotton", "French Terry", "Waffle Knit", "Polyester"];
const NECKS = ["Round Neck", "Crew Neck", "Polo Collar", "V-Neck", "Mandarin Collar", "Hooded"];
const SLEEVES = ["Half Sleeve", "Full Sleeve", "Sleeveless", "Raglan Sleeve"];
const PATTERNS = ["Solid", "Graphic Print", "Striped", "Typography", "Colorblock", "Tie & Dye"];
const PACKS = ["Single", "Pack of 2", "Pack of 3", "Pack of 4"];

const SAMPLE_BRIEFS: { label: string; brief: ProductBrief }[] = [
  {
    label: "Men's Oversized Graphic Tee",
    brief: {
      platforms: ["amazon", "flipkart", "myntra", "meesho"],
      tshirt_type: "Oversized T-Shirt",
      color: "Black",
      gender: "men",
      fit: "Oversized",
      fabric: "100% Cotton",
      neck: "Round Neck",
      sleeve: "Half Sleeve",
      pattern: "Graphic Print",
      brand_name: "UrbanAura",
      pack: "Single",
      price_min: 599,
      price_max: 999,
      extra_details: "Streetwear aesthetic with anime back print, heavyweight 240 GSM drop shoulder",
      research_sources: ["amazon", "flipkart", "myntra", "meesho", "google", "reddit"],
    },
  },
  {
    label: "Women's Solid Cotton Tee",
    brief: {
      platforms: ["amazon", "flipkart", "myntra", "meesho"],
      tshirt_type: "Round Neck T-Shirt",
      color: "Lavender",
      gender: "women",
      fit: "Regular",
      fabric: "Bio-washed Cotton",
      neck: "Crew Neck",
      sleeve: "Half Sleeve",
      pattern: "Solid",
      brand_name: "LunaWear",
      pack: "Pack of 2",
      price_min: 499,
      price_max: 799,
      extra_details: "Breathable daily casual wear, soft handfeel combed cotton",
      research_sources: ["amazon", "flipkart", "myntra", "meesho", "google", "pinterest"],
    },
  },
];

export const BriefForm: React.FC<Props> = ({
  brief,
  onChange,
  onSubmit,
  isLoading,
  isKeyConfigured,
  onOpenKeyModal,
}) => {
  const [accordionOpen, setAccordionOpen] = useState(false);

  const handleUpdate = <K extends keyof ProductBrief>(key: K, value: ProductBrief[K]) => {
    onChange({ ...brief, [key]: value });
  };

  const handleLoadSample = (sample: ProductBrief) => {
    onChange(sample);
  };

  const isFormValid =
    brief.platforms.length > 0 &&
    Boolean(brief.tshirt_type?.trim()) &&
    Boolean(brief.color?.trim());

  return (
    <div className="w-full max-w-4xl mx-auto rounded-2xl border border-divider/80 bg-content1/80 backdrop-blur-md p-5 sm:p-7 flex flex-col gap-6 shadow-xs">
      {/* Sample Presets Header Bar */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-divider/60 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
          <Compass className="w-4 h-4 text-primary" />
          <span>Product Brief & Targeting</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-default-400">Quick Presets:</span>
          {SAMPLE_BRIEFS.map((s) => (
            <Button
              key={s.label}
              size="sm"
              variant="flat"
              className="h-7 text-xs px-2.5 rounded-lg font-medium bg-content2 hover:bg-default-200 text-default-700 border border-divider/60"
              onPress={() => handleLoadSample(s.brief)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Section 1: Target Marketplaces (Single heading, no duplicate label) */}
      <div>
        <PlatformPicker
          selectedPlatforms={brief.platforms}
          onChange={(plats) => handleUpdate("platforms", plats)}
        />
      </div>

      {/* Section 2: Target Audience */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-foreground flex items-center justify-between">
          <span>Target Audience</span>
          <span className="text-[11px] text-default-400 font-normal">Select one</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {GENDERS.map((g) => {
            const active = brief.gender === g;
            return (
              <button
                key={g}
                type="button"
                onClick={() => handleUpdate("gender", g)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize border transition-all duration-150 select-none ${
                  active
                    ? "bg-primary text-white border-primary shadow-xs"
                    : "bg-content2/60 hover:bg-content2 border-divider text-default-600 hover:text-foreground"
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 3: T-Shirt Silhouette */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-foreground flex items-center justify-between">
          <span>T-Shirt Silhouette</span>
          <span className="text-[11px] text-default-400 font-normal">Pick or type custom</span>
        </label>
        <Input
          size="sm"
          placeholder="e.g. Oversized T-Shirt, Polo T-Shirt"
          value={brief.tshirt_type || ""}
          onValueChange={(val) => handleUpdate("tshirt_type", val)}
          classNames={{
            inputWrapper: "h-9 rounded-xl border-divider bg-content2/40",
            input: "text-xs font-medium",
          }}
        />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {TSHIRT_TYPES.map((type) => {
            const isSelected = brief.tshirt_type === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleUpdate("tshirt_type", type)}
                className={`text-xs px-2.5 py-1 rounded-xl border transition-all select-none ${
                  isSelected
                    ? "bg-primary-50 dark:bg-primary-950/40 border-primary text-primary font-bold shadow-2xs"
                    : "bg-content2/40 hover:bg-content2 border-divider text-default-600 hover:text-foreground"
                }`}
              >
                {type}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 4: Color with Interactive Swatches */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-foreground flex items-center justify-between">
          <span>Garment Color</span>
          <span className="text-[11px] text-default-400 font-normal">Click swatch or type custom</span>
        </label>
        <Input
          size="sm"
          placeholder="e.g. Black, Navy Blue, Maroon"
          value={brief.color || ""}
          onValueChange={(val) => handleUpdate("color", val)}
          classNames={{
            inputWrapper: "h-9 rounded-xl border-divider bg-content2/40",
            input: "text-xs font-medium",
          }}
        />
        <div className="flex flex-wrap gap-2 pt-1">
          {COLOR_SWATCHES.map((swatch) => {
            const isSelected = brief.color?.toLowerCase() === swatch.name.toLowerCase();
            return (
              <button
                key={swatch.name}
                type="button"
                onClick={() => handleUpdate("color", swatch.name)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border transition-all select-none ${
                  isSelected
                    ? "bg-primary-50 dark:bg-primary-950/40 border-primary text-primary font-bold shadow-2xs"
                    : "bg-content2/40 hover:bg-content2 border-divider text-default-600 hover:text-foreground"
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-full inline-block shrink-0 shadow-2xs ${
                    swatch.isLight ? "border border-default-300" : ""
                  }`}
                  style={{ backgroundColor: swatch.hex }}
                />
                <span>{swatch.name}</span>
                {isSelected && <Check className="w-3 h-3 text-primary ml-0.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 5: Brand & Pricing */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Brand Name</label>
          <Input
            size="sm"
            placeholder="e.g. UrbanStyle"
            value={brief.brand_name || ""}
            onValueChange={(val) => handleUpdate("brand_name", val)}
            classNames={{
              inputWrapper: "h-9 rounded-xl border-divider bg-content2/40",
              input: "text-xs font-medium",
            }}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Min Price (₹)</label>
          <Input
            size="sm"
            type="number"
            placeholder="599"
            value={brief.price_min ? String(brief.price_min) : ""}
            onValueChange={(val) => handleUpdate("price_min", val ? Number(val) : null)}
            classNames={{
              inputWrapper: "h-9 rounded-xl border-divider bg-content2/40",
              input: "text-xs font-medium",
            }}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Max Price (₹)</label>
          <Input
            size="sm"
            type="number"
            placeholder="999"
            value={brief.price_max ? String(brief.price_max) : ""}
            onValueChange={(val) => handleUpdate("price_max", val ? Number(val) : null)}
            classNames={{
              inputWrapper: "h-9 rounded-xl border-divider bg-content2/40",
              input: "text-xs font-medium",
            }}
          />
        </div>
      </div>

      {/* Section 6: Specific Aesthetic / Design Details */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-foreground block">
          Special Aesthetic or Graphics Note
        </label>
        <Textarea
          minRows={2}
          maxRows={4}
          placeholder="e.g. Heavyweight 240 GSM drop shoulder streetwear tee with Japanese anime back print"
          value={brief.extra_details || ""}
          onValueChange={(val) => handleUpdate("extra_details", val)}
          classNames={{
            inputWrapper: "rounded-xl border-divider bg-content2/40 p-3",
            input: "text-xs font-medium",
          }}
        />
      </div>

      {/* Collapsible Advanced Attribute Specifications */}
      <Accordion isCompact variant="bordered" className="border border-divider/60 rounded-xl px-2">
        <AccordionItem
          key="advanced"
          aria-label="Advanced Garment Attributes"
          title={
            <div className="flex items-center gap-2 text-xs font-bold text-default-600">
              <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
              <span>Optional Attributes (Fabric, Neck, Sleeve, Pattern)</span>
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-3 pt-1">
            <div>
              <label className="text-[11px] font-semibold text-foreground block mb-1">Fabric</label>
              <div className="flex flex-wrap gap-1">
                {FABRICS.map((f) => (
                  <Chip
                    key={f}
                    size="sm"
                    variant={brief.fabric === f ? "solid" : "bordered"}
                    color={brief.fabric === f ? "primary" : "default"}
                    className="cursor-pointer text-[11px]"
                    onClick={() => handleUpdate("fabric", brief.fabric === f ? null : f)}
                  >
                    {f}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-foreground block mb-1">Neck Style</label>
              <div className="flex flex-wrap gap-1">
                {NECKS.map((n) => (
                  <Chip
                    key={n}
                    size="sm"
                    variant={brief.neck === n ? "solid" : "bordered"}
                    color={brief.neck === n ? "primary" : "default"}
                    className="cursor-pointer text-[11px]"
                    onClick={() => handleUpdate("neck", brief.neck === n ? null : n)}
                  >
                    {n}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-foreground block mb-1">Sleeve</label>
              <div className="flex flex-wrap gap-1">
                {SLEEVES.map((s) => (
                  <Chip
                    key={s}
                    size="sm"
                    variant={brief.sleeve === s ? "solid" : "bordered"}
                    color={brief.sleeve === s ? "primary" : "default"}
                    className="cursor-pointer text-[11px]"
                    onClick={() => handleUpdate("sleeve", brief.sleeve === s ? null : s)}
                  >
                    {s}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-foreground block mb-1">Pattern</label>
              <div className="flex flex-wrap gap-1">
                {PATTERNS.map((p) => (
                  <Chip
                    key={p}
                    size="sm"
                    variant={brief.pattern === p ? "solid" : "bordered"}
                    color={brief.pattern === p ? "primary" : "default"}
                    className="cursor-pointer text-[11px]"
                    onClick={() => handleUpdate("pattern", brief.pattern === p ? null : p)}
                  >
                    {p}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </AccordionItem>
      </Accordion>

      {/* Submit Action CTA */}
      <div className="flex items-center justify-between pt-2 border-t border-divider/60 flex-wrap gap-3">
        <span className="text-xs text-default-400">
          Targeting {brief.platforms.length} marketplaces with Bayesian rating scraping.
        </span>

        <Button
          size="md"
          color="primary"
          variant="solid"
          isLoading={isLoading}
          isDisabled={!isFormValid || isLoading}
          onPress={onSubmit}
          className="px-6 rounded-xl font-bold text-xs shadow-md shadow-primary/20"
          startContent={!isLoading && <Sparkles className="w-4 h-4 text-indigo-200" />}
        >
          {isLoading ? "Running Research Pipeline..." : "Start Market Research"}
        </Button>
      </div>
    </div>
  );
};
