import React, { useState, useEffect, useRef } from "react";
import { Card, CardBody, Input, Button, Chip } from "@heroui/react";
import { Building2, Package, Tag, Check, CheckCircle2, IndianRupee, Shirt, Hash } from "lucide-react";
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

  // Sync state if session or user defaults update
  useEffect(() => {
    if (session?.global_meta?.brand) setBrand(session.global_meta.brand);
    else if (user?.brand_defaults?.brand) setBrand(user.brand_defaults.brand);

    if (session?.global_meta?.manufacturer) setManufacturer(session.global_meta.manufacturer);
    else if (user?.brand_defaults?.manufacturer) setManufacturer(user.brand_defaults.manufacturer);

    if (session?.global_meta?.packer) setPacker(session.global_meta.packer);
    else if (user?.brand_defaults?.packer) setPacker(user.brand_defaults.packer);

    if (session?.global_meta?.hsn) setHsn(session.global_meta.hsn);
    else if (user?.brand_defaults?.hsn) setHsn(user.brand_defaults.hsn);

    if (session?.global_meta?.mrp) setMrp(String(session.global_meta.mrp));
    else if (user?.brand_defaults?.mrp) setMrp(String(user.brand_defaults.mrp));

    if (session?.global_meta?.selling_price) setSellingPrice(String(session.global_meta.selling_price));
    else if (user?.brand_defaults?.selling_price) setSellingPrice(String(user.brand_defaults.selling_price));

    if (session?.global_meta?.sleeve) setSleeve(session.global_meta.sleeve);
    else if (user?.brand_defaults?.sleeve) setSleeve(user.brand_defaults.sleeve);
  }, [session?.global_meta, user?.brand_defaults]);

  const handleApply = async (overrides?: {
    brand?: string;
    manufacturer?: string;
    packer?: string;
    hsn?: string;
    mrp?: string;
    selling_price?: string;
    sleeve?: string;
  }) => {
    const b = (overrides?.brand !== undefined ? overrides.brand : brand).trim();
    const m = (overrides?.manufacturer !== undefined ? overrides.manufacturer : manufacturer).trim();
    const p = (overrides?.packer !== undefined ? overrides.packer : packer).trim();
    const h = (overrides?.hsn !== undefined ? overrides.hsn : hsn).trim();
    const mrpVal = (overrides?.mrp !== undefined ? overrides.mrp : mrp).trim();
    const spVal = (overrides?.selling_price !== undefined ? overrides.selling_price : sellingPrice).trim();
    const slVal = (overrides?.sleeve !== undefined ? overrides.sleeve : sleeve).trim();

    if (!b && !m && !p && !h && !mrpVal && !spVal && !slVal) return;

    setIsSaving(true);
    setSaveStatus("idle");

    try {
      // 1. Apply across session designs (Backend builder uses these for Columns AG, AB, AC, Y, K, L, AL)
      const res = await applyMetaToAll(sessionId, {
        brand: b,
        manufacturer: m,
        packer: p,
        hsn: h,
        mrp: mrpVal,
        selling_price: spVal,
        sleeve: slVal,
      });

      if (session) {
        setSession({
          ...session,
          global_meta: res.global_meta,
          design_meta: res.design_meta,
          designs: res.designs || session.designs,
          summary: res.summary || session.summary,
        });
      }

      // 2. Persist in user account in MongoDB so every new sheet gets these defaults
      await saveUserBrandDefaults({
        brand: b,
        manufacturer: m,
        packer: p,
        hsn: h,
        mrp: mrpVal,
        selling_price: spVal,
        sleeve: slVal,
      }).catch(() => {
        // Soft fail if DB temporarily offline
      });

      // 3. Persist in localStorage for instant local availability
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("fk_brand_name", b);
        localStorage.setItem("fk_manufacturer_name", m);
        localStorage.setItem("fk_packer_name", p);
        localStorage.setItem("fk_hsn_code", h);
        localStorage.setItem("fk_mrp", mrpVal);
        localStorage.setItem("fk_selling_price", spVal);
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
    if (brand.trim() || manufacturer.trim() || packer.trim() || hsn.trim() || mrp.trim() || sellingPrice.trim() || sleeve.trim()) {
      handleApply();
    }
  };

  return (
    <Card
      shadow="sm"
      className="border border-divider bg-content1/80 backdrop-blur-md rounded-[14px] overflow-hidden"
    >
      <CardBody className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[8px] bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  Catalog Defaults
                </span>
                <Chip
                  size="sm"
                  variant="flat"
                  color="primary"
                  className="h-5 text-[10px] font-semibold tracking-wide uppercase px-1.5"
                >
                  Applied across all T-shirts
                </Chip>
              </div>
              <p className="text-xs text-default-500">
                Fills Brand (AG), Manufacturer (AB), Packer (AC), HSN (Y), MRP (K), Selling Price (L), and Sleeve (AL) across all entries in this workbook.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-xs text-success-600 dark:text-success-400 font-medium animate-fadeIn">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Applied to all
              </span>
            )}
            <Button
              size="sm"
              color="primary"
              variant="flat"
              isLoading={isSaving}
              onPress={() => handleApply()}
              startContent={!isSaving && <Check className="w-3.5 h-3.5" />}
              className="h-8 px-3 rounded-[9px] font-medium text-xs shadow-xs"
            >
              Apply to all T-shirts
            </Button>
          </div>
        </div>

        {/* 7 Responsive Global Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {/* 1. Brand (Col AG) */}
          <div>
            <label className="block text-[11px] font-medium text-default-600 mb-1">
              Brand <span className="text-default-400 font-normal">(Col AG)</span>
            </label>
            <Input
              size="sm"
              variant="bordered"
              radius="sm"
              placeholder="fashion continental"
              value={brand}
              onValueChange={setBrand}
              onBlur={handleBlur}
              startContent={<Tag className="w-3.5 h-3.5 text-default-400 shrink-0 mr-1" />}
              classNames={{
                inputWrapper:
                  "h-9 rounded-[10px] bg-content2 border-divider hover:border-default-400 focus-within:border-primary",
                input: "text-xs font-medium",
              }}
            />
          </div>

          {/* 2. Manufacturer Details (Col AB) */}
          <div>
            <label className="block text-[11px] font-medium text-default-600 mb-1">
              Manufacturer <span className="text-default-400 font-normal">(Col AB)</span>
            </label>
            <Input
              size="sm"
              variant="bordered"
              radius="sm"
              placeholder="fashion continental, Surat"
              value={manufacturer}
              onValueChange={(val) => {
                setManufacturer(val);
                if (packer === manufacturer) {
                  setPacker(val);
                }
              }}
              onBlur={handleBlur}
              startContent={<Building2 className="w-3.5 h-3.5 text-default-400 shrink-0 mr-1" />}
              classNames={{
                inputWrapper:
                  "h-9 rounded-[10px] bg-content2 border-divider hover:border-default-400 focus-within:border-primary",
                input: "text-xs font-medium",
              }}
            />
          </div>

          {/* 3. Packer Details (Col AC) */}
          <div>
            <label className="block text-[11px] font-medium text-default-600 mb-1">
              Packer <span className="text-default-400 font-normal">(Col AC)</span>
            </label>
            <Input
              size="sm"
              variant="bordered"
              radius="sm"
              placeholder="fashion continental, Surat"
              value={packer}
              onValueChange={setPacker}
              onBlur={handleBlur}
              startContent={<Package className="w-3.5 h-3.5 text-default-400 shrink-0 mr-1" />}
              classNames={{
                inputWrapper:
                  "h-9 rounded-[10px] bg-content2 border-divider hover:border-default-400 focus-within:border-primary",
                input: "text-xs font-medium",
              }}
            />
          </div>

          {/* 4. HSN Code (Col Y) */}
          <div>
            <label className="block text-[11px] font-medium text-default-600 mb-1">
              HSN Code <span className="text-default-400 font-normal">(Col Y)</span>
            </label>
            <Input
              size="sm"
              variant="bordered"
              radius="sm"
              placeholder="610910"
              value={hsn}
              onValueChange={setHsn}
              onBlur={handleBlur}
              startContent={<Hash className="w-3.5 h-3.5 text-default-400 shrink-0 mr-1" />}
              classNames={{
                inputWrapper:
                  "h-9 rounded-[10px] bg-content2 border-divider hover:border-default-400 focus-within:border-primary",
                input: "text-xs font-medium",
              }}
            />
          </div>

          {/* 5. MRP (Col K) */}
          <div>
            <label className="block text-[11px] font-medium text-default-600 mb-1">
              MRP <span className="text-default-400 font-normal">(Col K)</span>
            </label>
            <Input
              size="sm"
              variant="bordered"
              radius="sm"
              type="number"
              placeholder="1999"
              value={mrp}
              onValueChange={setMrp}
              onBlur={handleBlur}
              startContent={<IndianRupee className="w-3.5 h-3.5 text-default-400 shrink-0 mr-0.5" />}
              classNames={{
                inputWrapper:
                  "h-9 rounded-[10px] bg-content2 border-divider hover:border-default-400 focus-within:border-primary",
                input: "text-xs font-medium",
              }}
            />
          </div>

          {/* 6. Your Selling Price (Col L) */}
          <div>
            <label className="block text-[11px] font-medium text-default-600 mb-1">
              Selling Price <span className="text-default-400 font-normal">(Col L)</span>
            </label>
            <Input
              size="sm"
              variant="bordered"
              radius="sm"
              type="number"
              placeholder="749"
              value={sellingPrice}
              onValueChange={setSellingPrice}
              onBlur={handleBlur}
              startContent={<IndianRupee className="w-3.5 h-3.5 text-default-400 shrink-0 mr-0.5" />}
              classNames={{
                inputWrapper:
                  "h-9 rounded-[10px] bg-content2 border-divider hover:border-default-400 focus-within:border-primary",
                input: "text-xs font-medium",
              }}
            />
          </div>

          {/* 7. Sleeve (Col AL) */}
          <div>
            <label className="block text-[11px] font-medium text-default-600 mb-1">
              Sleeve <span className="text-default-400 font-normal">(Col AL)</span>
            </label>
            <div className="relative">
              <select
                value={sleeve}
                onChange={(e) => {
                  const val = e.target.value;
                  setSleeve(val);
                  handleApply({ sleeve: val });
                }}
                className="w-full h-9 rounded-[10px] bg-content2 border border-divider hover:border-default-400 focus:border-primary text-xs font-medium pl-8 pr-3 text-foreground outline-none transition-colors appearance-none cursor-pointer"
              >
                {SLEEVE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-content1 text-foreground">
                    {opt.label}
                  </option>
                ))}
              </select>
              <Shirt className="w-3.5 h-3.5 text-default-400 absolute left-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
