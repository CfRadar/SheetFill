import React, { useState, useEffect, useRef } from "react";
import { Card, CardBody, Input, Button, Chip } from "@heroui/react";
import { Building2, Package, Tag, Check, CheckCircle2, RefreshCw } from "lucide-react";
import { applyMetaToAll, saveUserBrandDefaults } from "../api";
import { useAuthStore } from "../auth/authStore";
import { useAppStore } from "../store";

interface GlobalBrandBarProps {
  sessionId: string;
}

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

  const [brand, setBrand] = useState<string>(getInitialBrand);
  const [manufacturer, setManufacturer] = useState<string>(getInitialManufacturer);
  const [packer, setPacker] = useState<string>(getInitialPacker);

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
  }, [session?.global_meta, user?.brand_defaults]);

  const handleApply = async (
    overrideBrand?: string,
    overrideMfg?: string,
    overridePacker?: string
  ) => {
    const b = (overrideBrand !== undefined ? overrideBrand : brand).trim();
    const m = (overrideMfg !== undefined ? overrideMfg : manufacturer).trim();
    const p = (overridePacker !== undefined ? overridePacker : packer).trim();

    if (!b && !m && !p) return;

    setIsSaving(true);
    setSaveStatus("idle");

    try {
      // 1. Apply across session designs (Backend builder uses these for Columns AG, AB, AC)
      const res = await applyMetaToAll(sessionId, {
        brand: b,
        manufacturer: m,
        packer: p,
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
      }).catch(() => {
        // Soft fail if DB temporarily offline
      });

      // 3. Persist in localStorage for instant local availability
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("fk_brand_name", b);
        localStorage.setItem("fk_manufacturer_name", m);
        localStorage.setItem("fk_packer_name", p);
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
    // Only auto-trigger if there are values
    if (brand.trim() || manufacturer.trim() || packer.trim()) {
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
                  Listing Details
                </span>
                <Chip
                  size="sm"
                  variant="flat"
                  color="primary"
                  className="h-5 text-[10px] font-semibold tracking-wide uppercase px-1.5"
                >
                  Filled once for all T-shirts
                </Chip>
              </div>
              <p className="text-xs text-default-500">
                Fills Columns AG (Brand), AB (Manufacturer), and AC (Packer) for every product in this workbook. Saved to your account.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-xs text-success-600 dark:text-success-400 font-medium animate-fadeIn">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Saved for your account
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

        {/* 3 Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-default-600 mb-1">
              Brand <span className="text-default-400 font-normal">(Col AG)</span>
            </label>
            <Input
              size="sm"
              variant="bordered"
              radius="sm"
              placeholder="e.g. fashion continental"
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

          <div>
            <label className="block text-[11px] font-medium text-default-600 mb-1">
              Manufacturer Details <span className="text-default-400 font-normal">(Col AB)</span>
            </label>
            <Input
              size="sm"
              variant="bordered"
              radius="sm"
              placeholder="e.g. fashion continental, Surat"
              value={manufacturer}
              onValueChange={(val) => {
                setManufacturer(val);
                // If packer was identical to old manufacturer, keep it in sync
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

          <div>
            <label className="block text-[11px] font-medium text-default-600 mb-1">
              Packer Details <span className="text-default-400 font-normal">(Col AC)</span>
            </label>
            <Input
              size="sm"
              variant="bordered"
              radius="sm"
              placeholder="e.g. fashion continental, Surat"
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
        </div>
      </CardBody>
    </Card>
  );
};
