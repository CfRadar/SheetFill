import React, { useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Chip,
} from "@heroui/react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Globe,
  Key,
} from "lucide-react";
import { getPreflight } from "../api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenKeyModal: () => void;
}

export const SystemCheckModal: React.FC<Props> = ({ isOpen, onClose, onOpenKeyModal }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPreflight = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await getPreflight();
      setData(resp);
    } catch (err: any) {
      setError(err?.message || "Failed to load system preflight check.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPreflight();
    }
  }, [isOpen]);

  const hasKey = data?.openrouter_key_configured;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2 pb-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <span className="text-sm font-semibold">Keyword Agent System Health</span>
        </ModalHeader>
        <ModalBody className="py-3 flex flex-col gap-3">
          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-default-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin text-primary" />
              <span>Running preflight diagnostics...</span>
            </div>
          ) : error ? (
            <div className="p-3 rounded-lg bg-danger-50 dark:bg-danger-950/30 border border-danger-200 text-danger text-xs">
              {error}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Overall status */}
              <div className="p-3 rounded-lg bg-default-50 dark:bg-default-100/10 border border-divider flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Operational Status</span>
                <Chip
                  size="sm"
                  variant="flat"
                  color={data?.status === "ok" ? "success" : "warning"}
                  className="font-semibold text-xs"
                >
                  {data?.status === "ok" ? "All Systems Ready" : "Attention Required"}
                </Chip>
              </div>

              {/* Item Diagnostics */}
              <div className="flex flex-col gap-2">
                {/* 1. BYOK Key */}
                <div className="p-2.5 rounded-md border border-divider flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-primary" />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-foreground">
                        OpenRouter API Key (BYOK)
                      </span>
                      <span className="text-[11px] text-default-400">
                        {hasKey
                          ? `Configured (ends with ••••${data?.key_last4 || ""})`
                          : "Missing — Please add your key to run AI stages"}
                      </span>
                    </div>
                  </div>
                  {hasKey ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : (
                    <Button
                      size="sm"
                      color="warning"
                      variant="flat"
                      className="h-6 text-[10px] px-2 font-medium"
                      onPress={() => {
                        onClose();
                        onOpenKeyModal();
                      }}
                    >
                      Set Key
                    </Button>
                  )}
                </div>

                {/* 2. Scraper Health */}
                <div className="p-2.5 rounded-md border border-divider flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-secondary" />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-foreground">
                        Marketplace Scrapers
                      </span>
                      <span className="text-[11px] text-default-400">
                        Amazon, Flipkart, Myntra, Meesho HTTP/JSON extractors
                      </span>
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-success" />
                </div>

                {/* 3. Deterministic Title Engine */}
                <div className="p-2.5 rounded-md border border-divider flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-success" />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-foreground">
                        Deterministic Title Engine
                      </span>
                      <span className="text-[11px] text-default-400">
                        YAML platform rules, claim whitelists & formula composer
                      </span>
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-success" />
                </div>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter className="pt-2">
          <Button
            size="sm"
            variant="light"
            className="text-xs"
            startContent={<RefreshCw className="w-3.5 h-3.5" />}
            onPress={fetchPreflight}
            isLoading={loading}
          >
            Re-run Check
          </Button>
          <Button size="sm" variant="flat" className="text-xs" onPress={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
