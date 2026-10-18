import React, { useState, useEffect, useRef } from "react";
import { Input, Button, Tooltip, Select, SelectItem } from "@heroui/react";
import {
  Building2,
  Tag,
  Check,
  CheckCircle2,
  IndianRupee,
  Shirt,
  Hash,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { applyMetaToAll, saveUserBrandDefaults } from "../api";
import { useAuthStore } from "../auth/authStore";
import { useAppStore } from "../store";

interface GlobalBrandBarProps {
  sessionId: string;
}

const SLEEVE_OPTIONS = [
  { value: "Half Sleeve", label: "Half Sleeve" },
  { value: "Full Sleeve", label: "Full Sleeve" },
  { value: "Short Sleeve", label: "Short Sleeve" },
  { value: "Sleeveless", label: "Sleeveless" },
  { value: "3/4 Sleeve", label: "3/4 Sleeve" },
];

export const GlobalBrandBar: React.FC<GlobalBrandBarProps> = ({ sessionId }) => {
  const { session, setSession, setError } = useAppStore();
  const { user } = useAuthStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const getInitialBrand = (): string => {
    return (
      session?.global_meta?.brand ||
      user?.brand_defaults?.brand ||
      (typeof localStorage !== "undefined" ? localStorage.getItem("fk_brand_name") : null) ||
      "fashion continental"
    );
  };

  const getInitialManufacturer = (): string => {
    return (
      session?.global_meta?.manufacturer ||
      user?.brand_defaults?.manufacturer ||
      (typeof localStorage !== "undefined" ? localStorage.getItem("fk_manufacturer_name") : null) ||
      "fashion continental"
    );
  };

  const getInitialPacker = (): string => {
    return (
      session?.global_meta?.packer ||
      user?.brand_defaults?.packer ||
      (typeof localStorage !== "undefined" ? localStorage.getItem("fk_packer_name") : null) ||
      getInitialManufacturer()
    );
  };

  const getInitialHsn = (): string => {
    return (
      session?.global_meta?.hsn ||
      user?.brand_defaults?.hsn ||
      (typeof localStorage !== "undefined" ? localStorage.getItem("fk_hsn_code") : null) ||
      "610910"
    );
  };

  const getInitialMrp = (): string => {
    const val =
      session?.global_meta?.mrp ??
      user?.brand_defaults?.mrp ??
      (typeof localStorage !== "undefined" ? localStorage.getItem("fk_mrp") : null) ??
      "1999";
    return String(val);
  };

  const getInitialSellingPrice = (): string => {
    const val =
      session?.global_meta?.selling_price ??
      user?.brand_defaults?.selling_price ??
      (typeof localStorage !== "undefined" ? localStorage.getItem("fk_selling_price") : null) ??
      "749";
    return String(val);
  };

  const getInitialSleeve = (): string => {
    return (
      session?.global_meta?.sleeve ||
      user?.brand_defaults?.sleeve ||
      (typeof localStorage !== "undefined" ? localStorage.getItem("fk_sleeve") : null) ||
      "Half Sleeve"
    );
  };

  const [brand, setBrand] = useState<string>(getInitialBrand);
  const [manufacturer, setManufacturer] = useState<string>(getInitialManufacturer);
  const [packer, setPacker] = useState<string>(getInitialPacker);
  const [hsn, setHsn] = useState<string>(getInitialHsn);
  const [mrp, setMrp] = useState<string>(getInitialMrp);
  const [sellingPrice, setSellingPrice] = useState<string>(getInitialSellingPrice);
  const [sleeve, setSleeve] = useState<string>(getInitialSleeve);

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (session?.global_meta) {
      if (session.global_meta.brand) setBrand(session.global_meta.brand);
      if (session.global_meta.manufacturer) setManufacturer(session.global_meta.manufacturer);
      if (session.global_meta.packer) setPacker(session.global_meta.packer);
      if (session.global_meta.hsn) setHsn(session.global_meta.hsn);
      if (session.global_meta.mrp !== undefined) setMrp(String(session.global_meta.mrp));
      if (session.global_meta.selling_price !== undefined) setSellingPrice(String(session.global_meta.selling_price));
      if (session.global_meta.sleeve) setSleeve(session.global_meta.sleeve);
    }
  }, [session?.global_meta]);

  const handleApply = async (
    customBrand?: string,
    customMfr?: string,
    customPacker?: string,
    customHsn?: string,
    customMrp?: string,
    customSp?: string,
    customSleeve?: string
  ) => {
    const b = customBrand !== undefined ? customBrand : brand;
    const m = customMfr !== undefined ? customMfr : manufacturer;
    const p = customPacker !== undefined ? customPacker : packer;
    const h = customHsn !== undefined ? customHsn : hsn;
    const rawMrp = customMrp !== undefined ? customMrp : mrp;
    const rawSp = customSp !== undefined ? customSp : sellingPrice;
    const sl = customSleeve !== undefined ? customSleeve : sleeve;

    const mrpVal = parseFloat(rawMrp) || 1999;
    const spVal = parseFloat(rawSp) || 749;
    const slVal = sl.trim() || "Half Sleeve";

    try {
      setIsSaving(true);
      setError(null);

      const updated = await applyMetaToAll(sessionId, {
        brand: b,
        manufacturer: m,
        packer: p,
        hsn: h,
        mrp: mrpVal,
        selling_price: spVal,
        sleeve: slVal,
      });

      setSession(updated);

      saveUserBrandDefaults({
        brand: b,
        manufacturer: m,
        packer: p,
        hsn: h,
        mrp: mrpVal,
        selling_price: spVal,
        sleeve: slVal,
      }).catch(() => {});

      if (typeof localStorage !== "undefined") {
        localStorage.setItem("fk_brand_name", b);
        localStorage.setItem("fk_manufacturer_name", m);
        localStorage.setItem("fk_packer_name", p);
        localStorage.setItem("fk_hsn_code", h);
        localStorage.setItem("fk_mrp", String(mrpVal));
        localStorage.setItem("fk_selling_price", String(spVal));
        localStorage.setItem("fk_sleeve", slVal);
      }

      setSaveStatus("saved");
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setSaveStatus("idle");
      }, 3500);
    } catch (err: any) {
      setError(err?.message || "Failed to update listing details");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBlur = () => {
    handleApply();
  };

  return (
    <div className="w-full rounded-2xl border border-divider/80 bg-content1/80 backdrop-blur-md overflow-hidden transition-all duration-200 shadow-xs">
      {/* Compact Collapsible Summary Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        className="p-3 sm:px-4 sm:py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-content2/50 transition-colors select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Building2 className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="text-xs font-bold text-foreground">Catalog Defaults:</span>
            <span className="text-xs text-default-500 font-medium truncate">
              Brand <strong className="text-foreground">"{brand}"</strong> · Packer <strong className="text-foreground">"{packer}"</strong> · ₹{sellingPrice} (MRP ₹{mrp}) · HSN {hsn} · {sleeve}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium animate-fadeIn">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Applied
            </span>
          )}
          <Button
            size="sm"
            variant="light"
            className="h-7 px-2 text-xs font-medium text-default-600 rounded-lg"
          >
            {isExpanded ? (
              <>
                <span>Collapse</span>
                <ChevronUp className="w-3.5 h-3.5 ml-1" />
              </>
            ) : (
              <>
                <span>Edit</span>
                <ChevronDown className="w-3.5 h-3.5 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Expanded Form Grid */}
      {isExpanded && (
        <div className="p-4 sm:p-5 border-t border-divider/60 bg-content2/30 space-y-4 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {/* 1. Brand */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-foreground">Brand</label>
                <Tooltip content="Workbook Column AG (Brand Name)" placement="top" delay={150}>
                  <Info className="w-3 h-3 text-default-400 cursor-help" />
                </Tooltip>
              </div>
              <Input
                size="sm"
                variant="bordered"
                radius="sm"
                aria-label="Brand"
                placeholder="fashion continental"
                value={brand}
                onValueChange={setBrand}
                onBlur={handleBlur}
                startContent={<Tag className="w-3.5 h-3.5 text-default-400 shrink-0 mr-1" />}
                classNames={{
                  inputWrapper: "h-9 rounded-xl bg-content1 border-divider",
                  input: "text-xs font-medium",
                }}
              />
            </div>

            {/* 2. Manufacturer */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-foreground">Manufacturer</label>
                <Tooltip content="Workbook Column AB (Manufacturer Details)" placement="top" delay={150}>
                  <Info className="w-3 h-3 text-default-400 cursor-help" />
                </Tooltip>
              </div>
              <Input
                size="sm"
                variant="bordered"
                radius="sm"
                aria-label="Manufacturer"
                placeholder="fashion continental"
                value={manufacturer}
                onValueChange={setManufacturer}
                onBlur={handleBlur}
                startContent={<Building2 className="w-3.5 h-3.5 text-default-400 shrink-0 mr-1" />}
                classNames={{
                  inputWrapper: "h-9 rounded-xl bg-content1 border-divider",
                  input: "text-xs font-medium",
                }}
              />
            </div>

            {/* 3. Packer */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-foreground">Packer</label>
                <Tooltip content="Workbook Column AC (Packer Details)" placement="top" delay={150}>
                  <Info className="w-3 h-3 text-default-400 cursor-help" />
                </Tooltip>
              </div>
              <Input
                size="sm"
                variant="bordered"
                radius="sm"
                aria-label="Packer"
                placeholder="fashion continental"
                value={packer}
                onValueChange={setPacker}
                onBlur={handleBlur}
                startContent={<Building2 className="w-3.5 h-3.5 text-default-400 shrink-0 mr-1" />}
                classNames={{
                  inputWrapper: "h-9 rounded-xl bg-content1 border-divider",
                  input: "text-xs font-medium",
                }}
              />
            </div>

            {/* 4. HSN */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-foreground">HSN Code</label>
                <Tooltip content="Workbook Column Y (Harmonized System of Nomenclature)" placement="top" delay={150}>
                  <Info className="w-3 h-3 text-default-400 cursor-help" />
                </Tooltip>
              </div>
              <Input
                size="sm"
                variant="bordered"
                radius="sm"
                aria-label="HSN Code"
                placeholder="610910"
                value={hsn}
                onValueChange={setHsn}
                onBlur={handleBlur}
                startContent={<Hash className="w-3.5 h-3.5 text-default-400 shrink-0 mr-1" />}
                classNames={{
                  inputWrapper: "h-9 rounded-xl bg-content1 border-divider",
                  input: "text-xs font-mono font-medium",
                }}
              />
            </div>

            {/* 5. MRP */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-foreground">Maximum Retail Price</label>
                <Tooltip content="Workbook Column K (Maximum Retail Price in INR)" placement="top" delay={150}>
                  <Info className="w-3 h-3 text-default-400 cursor-help" />
                </Tooltip>
              </div>
              <Input
                size="sm"
                variant="bordered"
                radius="sm"
                type="number"
                aria-label="Maximum Retail Price"
                placeholder="1999"
                value={mrp}
                onValueChange={setMrp}
                onBlur={handleBlur}
                startContent={<IndianRupee className="w-3.5 h-3.5 text-default-400 shrink-0 mr-1" />}
                classNames={{
                  inputWrapper: "h-9 rounded-xl bg-content1 border-divider",
                  input: "text-xs font-medium",
                }}
              />
            </div>

            {/* 6. Selling Price */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-foreground">Selling Price</label>
                <Tooltip content="Workbook Column L (Your Selling Price in INR)" placement="top" delay={150}>
                  <Info className="w-3 h-3 text-default-400 cursor-help" />
                </Tooltip>
              </div>
              <Input
                size="sm"
                variant="bordered"
                radius="sm"
                type="number"
                aria-label="Selling Price"
                placeholder="749"
                value={sellingPrice}
                onValueChange={setSellingPrice}
                onBlur={handleBlur}
                startContent={<IndianRupee className="w-3.5 h-3.5 text-default-400 shrink-0 mr-1" />}
                classNames={{
                  inputWrapper: "h-9 rounded-xl bg-content1 border-divider",
                  input: "text-xs font-medium",
                }}
              />
            </div>

            {/* 7. Sleeve Type */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-foreground">Default Sleeve</label>
                <Tooltip content="Workbook Column AL (Sleeve Type)" placement="top" delay={150}>
                  <Info className="w-3 h-3 text-default-400 cursor-help" />
                </Tooltip>
              </div>
              <Select
                size="sm"
                variant="bordered"
                radius="sm"
                selectedKeys={[sleeve]}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0] as string;
                  if (val) {
                    setSleeve(val);
                    handleApply(undefined, undefined, undefined, undefined, undefined, undefined, val);
                  }
                }}
                aria-label="Default Sleeve"
                startContent={<Shirt className="w-3.5 h-3.5 text-default-400 shrink-0 mr-1" />}
                classNames={{
                  trigger: "h-9 rounded-xl bg-content1 border-divider",
                  value: "text-xs font-medium",
                }}
              >
                {SLEEVE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} textValue={opt.label}>
                    <span className="text-xs">{opt.label}</span>
                  </SelectItem>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-divider/60">
            <span className="text-[11px] text-default-400">
              Values automatically update across all designs in this sheet.
            </span>
            <Button
              size="sm"
              color="primary"
              variant="flat"
              isLoading={isSaving}
              onPress={() => handleApply()}
              startContent={!isSaving && <Check className="w-3.5 h-3.5" />}
              className="h-8 px-4 rounded-xl font-semibold text-xs"
            >
              Apply to All Designs
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
