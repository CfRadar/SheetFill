import React, { useState } from "react";
import {
  Button,
  Input,
  Textarea,
  Chip,
  Accordion,
  AccordionItem,
  Card,
  CardBody,
} from "@heroui/react";
import { Sparkles, SlidersHorizontal, RotateCcw, Compass } from "lucide-react";
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

const POPULAR_COLORS = [
  "Black",
  "White",
  "Navy Blue",
  "Olive Green",
  "Beige",
  "Maroon",
  "Grey Melange",
  "Lavender",
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
    <Card className="border border-divider/70 bg-content1 shadow-xs">
      <CardBody className="p-4 sm:p-5 flex flex-col gap-4">
        {/* Sample Presets Header */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-divider/60">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-default-600">
            <Compass className="w-3.5 h-3.5 text-primary" />
            <span>Product Brief</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-default-400">Presets:</span>
            {SAMPLE_BRIEFS.map((s) => (
              <Button
                key={s.label}
                size="sm"
                variant="flat"
                className="h-6 text-[10px] px-2 py-0 bg-default-100 hover:bg-default-200 text-default-700"
                onPress={() => handleLoadSample(s.brief)}
              >
                {s.label.split(" ")[0]} {s.label.split(" ")[1]}
              </Button>
            ))}
          </div>
        </div>

        {/* Target Platforms */}
        <div>
          <label className="text-xs font-medium text-foreground block mb-1.5">
            Target Marketplaces <span className="text-danger">*</span>
          </label>
          <PlatformPicker
            selectedPlatforms={brief.platforms}
            onChange={(plats) => handleUpdate("platforms", plats)}
          />
        </div>

        {/* Gender Selection */}
        <div>
          <label className="text-xs font-medium text-foreground block mb-1.5">
            Target Audience <span className="text-danger">*</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {GENDERS.map((g) => {
              const active = brief.gender === g;
              return (
                <Chip
                  key={g}
                  size="sm"
                  variant={active ? "solid" : "bordered"}
                  color={active ? "primary" : "default"}
                  className="cursor-pointer capitalize text-xs select-none"
                  onClick={() => handleUpdate("gender", g)}
                >
                  {g}
                </Chip>
              );
            })}
          </div>
        </div>

        {/* T-Shirt Type */}
        <div>
          <label className="text-xs font-medium text-foreground block mb-1">
            T-Shirt Type / Silhouette <span className="text-danger">*</span>
          </label>
          <Input
            size="sm"
            placeholder="e.g. Oversized T-Shirt, Polo T-Shirt"
            value={brief.tshirt_type || ""}
            onValueChange={(val) => handleUpdate("tshirt_type", val)}
            classNames={{ inputWrapper: "h-9" }}
          />
          <div className="flex flex-wrap gap-1 mt-1.5">
            {TSHIRT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={`text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                  brief.tshirt_type === type
                    ? "bg-primary-50 border-primary text-primary font-medium dark:bg-primary-950/40"
                    : "border-divider text-default-500 hover:border-default-400"
                }`}
                onClick={() => handleUpdate("tshirt_type", type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Primary Color */}
        <div>
          <label className="text-xs font-medium text-foreground block mb-1">
            Primary Color <span className="text-danger">*</span>
          </label>
          <Input
            size="sm"
            placeholder="e.g. Black, Navy Blue, Sage Green"
            value={brief.color || ""}
            onValueChange={(val) => handleUpdate("color", val)}
            classNames={{ inputWrapper: "h-9" }}
          />
          <div className="flex flex-wrap gap-1 mt-1.5">
            {POPULAR_COLORS.map((col) => (
              <button
                key={col}
                type="button"
                className={`text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                  brief.color === col
                    ? "bg-primary-50 border-primary text-primary font-medium dark:bg-primary-950/40"
                    : "border-divider text-default-500 hover:border-default-400"
                }`}
                onClick={() => handleUpdate("color", col)}
              >
                {col}
              </button>
            ))}
          </div>
        </div>

        {/* Brand Name */}
        <div>
          <label className="text-xs font-medium text-foreground block mb-1">
            Brand Name <span className="text-[11px] text-default-400 font-normal">(Included in Title Engine rules)</span>
          </label>
          <Input
            size="sm"
            placeholder="e.g. Roadster, Wrogn, Generic"
            value={brief.brand_name || ""}
            onValueChange={(val) => handleUpdate("brand_name", val)}
            classNames={{ inputWrapper: "h-9" }}
          />
        </div>

        {/* Collapsible Attributes Accordion */}
        <Accordion className="px-0" variant="splitted">
          <AccordionItem
            key="attributes"
            aria-label="Detailed Specifications"
            title={
              <div className="flex items-center gap-1.5 text-xs font-medium text-default-700">
                <SlidersHorizontal className="w-3.5 h-3.5 text-default-500" />
                <span>Product Attributes & Specs</span>
                <span className="text-[10px] text-default-400 font-normal">(Fit, Fabric, Neck, Sleeve, Pattern)</span>
              </div>
            }
            className="border border-divider/60 shadow-none px-3 py-1 bg-default-50/50 dark:bg-default-100/10 rounded-lg"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 pb-2">
              {/* Fit */}
              <div>
                <label className="text-[11px] font-medium text-default-600 block mb-1">Fit Type</label>
                <div className="flex flex-wrap gap-1">
                  {FITS.map((fit) => (
                    <button
                      key={fit}
                      type="button"
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                        brief.fit === fit
                          ? "bg-primary text-white border-primary"
                          : "border-divider text-default-600 hover:border-default-400"
                      }`}
                      onClick={() => handleUpdate("fit", brief.fit === fit ? undefined : fit)}
                    >
                      {fit}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fabric */}
              <div>
                <label className="text-[11px] font-medium text-default-600 block mb-1">Fabric</label>
                <div className="flex flex-wrap gap-1">
                  {FABRICS.map((fab) => (
                    <button
                      key={fab}
                      type="button"
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                        brief.fabric === fab
                          ? "bg-primary text-white border-primary"
                          : "border-divider text-default-600 hover:border-default-400"
                      }`}
                      onClick={() => handleUpdate("fabric", brief.fabric === fab ? undefined : fab)}
                    >
                      {fab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Neck */}
              <div>
                <label className="text-[11px] font-medium text-default-600 block mb-1">Neck Style</label>
                <div className="flex flex-wrap gap-1">
                  {NECKS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                        brief.neck === n
                          ? "bg-primary text-white border-primary"
                          : "border-divider text-default-600 hover:border-default-400"
                      }`}
                      onClick={() => handleUpdate("neck", brief.neck === n ? undefined : n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sleeve */}
              <div>
                <label className="text-[11px] font-medium text-default-600 block mb-1">Sleeve</label>
                <div className="flex flex-wrap gap-1">
                  {SLEEVES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                        brief.sleeve === s
                          ? "bg-primary text-white border-primary"
                          : "border-divider text-default-600 hover:border-default-400"
                      }`}
                      onClick={() => handleUpdate("sleeve", brief.sleeve === s ? undefined : s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pattern */}
              <div>
                <label className="text-[11px] font-medium text-default-600 block mb-1">Pattern</label>
                <div className="flex flex-wrap gap-1">
                  {PATTERNS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                        brief.pattern === p
                          ? "bg-primary text-white border-primary"
                          : "border-divider text-default-600 hover:border-default-400"
                      }`}
                      onClick={() => handleUpdate("pattern", brief.pattern === p ? undefined : p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pack */}
              <div>
                <label className="text-[11px] font-medium text-default-600 block mb-1">Pack Quantity</label>
                <div className="flex flex-wrap gap-1">
                  {PACKS.map((pk) => (
                    <button
                      key={pk}
                      type="button"
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                        brief.pack === pk
                          ? "bg-primary text-white border-primary"
                          : "border-divider text-default-600 hover:border-default-400"
                      }`}
                      onClick={() => handleUpdate("pack", brief.pack === pk ? undefined : pk)}
                    >
                      {pk}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Band */}
              <div className="sm:col-span-2">
                <label className="text-[11px] font-medium text-default-600 block mb-1">
                  Target Price Band (₹ INR)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    size="sm"
                    type="number"
                    placeholder="Min (e.g. 499)"
                    value={brief.price_min ? String(brief.price_min) : ""}
                    onValueChange={(val) => handleUpdate("price_min", val ? Number(val) : null)}
                    classNames={{ inputWrapper: "h-8 text-xs" }}
                  />
                  <span className="text-xs text-default-400">to</span>
                  <Input
                    size="sm"
                    type="number"
                    placeholder="Max (e.g. 999)"
                    value={brief.price_max ? String(brief.price_max) : ""}
                    onValueChange={(val) => handleUpdate("price_max", val ? Number(val) : null)}
                    classNames={{ inputWrapper: "h-8 text-xs" }}
                  />
                </div>
              </div>

              {/* Extra Details */}
              <div className="sm:col-span-2">
                <label className="text-[11px] font-medium text-default-600 block mb-1">
                  Unique Features / Notes for AI
                </label>
                <Textarea
                  size="sm"
                  minRows={2}
                  placeholder="e.g. High-density puff print, 220 GSM bio-washed cotton, gym and streetwear crossover"
                  value={brief.extra_details || ""}
                  onValueChange={(val) => handleUpdate("extra_details", val)}
                  classNames={{ input: "text-xs" }}
                />
              </div>
            </div>
          </AccordionItem>
        </Accordion>

        {/* Submit or Key Configuration Warning */}
        <div className="pt-2">
          {!isKeyConfigured ? (
            <div className="flex flex-col gap-2 p-3 rounded-lg border border-warning/40 bg-warning/5 text-warning-700 dark:text-warning-300">
              <span className="text-xs font-medium">OpenRouter API Key Required (BYOK)</span>
              <p className="text-[11px] leading-relaxed text-default-500">
                You need to set your own OpenRouter key once. Keys are encrypted at rest with Fernet AES and never shared.
              </p>
              <Button
                size="sm"
                color="warning"
                variant="flat"
                className="font-semibold text-xs h-8"
                onPress={onOpenKeyModal}
              >
                Configure OpenRouter Key
              </Button>
            </div>
          ) : (
            <Button
              color="primary"
              size="md"
              className="w-full font-semibold text-sm shadow-md h-10 gap-2"
              isDisabled={!isFormValid || isLoading}
              isLoading={isLoading}
              onPress={onSubmit}
            >
              <Sparkles className="w-4 h-4" />
              <span>{isLoading ? "Running Keyword Agent..." : "Generate Strategy & Titles"}</span>
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
};
