import React, { useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Chip,
} from "@heroui/react";
import {
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  Plus,
  Shield,
  Layers,
  Activity,
} from "lucide-react";
import {
  getKeyStatus,
  saveKey,
  deleteKey,
  testKey,
  getModels,
  listUserKeys,
  addUserKey,
  deleteUserKey,
} from "../api";
import type { KeyStatus, MultiKeyItem } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onKeyUpdated?: (status: KeyStatus) => void;
}

const DEFAULT_MODELS = [
  "meta-llama/llama-3.3-70b-instruct",
  "google/gemini-2.0-flash-exp:free",
  "deepseek/deepseek-r1:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "qwen/qwen-2.5-72b-instruct",
  "mistralai/mistral-large-2407",
];

export const KeySettingsModal: React.FC<Props> = ({ isOpen, onClose, onKeyUpdated }) => {
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [keysList, setKeysList] = useState<MultiKeyItem[]>([]);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [keyLabelInput, setKeyLabelInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>("meta-llama/llama-3.3-70b-instruct");
  const [models, setModels] = useState<string[]>(DEFAULT_MODELS);
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingKey, setIsAddingKey] = useState(false);
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAll();
      setApiKeyInput("");
      setKeyLabelInput("");
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  const loadAll = async () => {
    try {
      const [s, m, kl] = await Promise.all([
        getKeyStatus(),
        getModels(),
        listUserKeys().catch(() => []),
      ]);
      setStatus(s);
      setModels(m.allowed_models || []);
      setKeysList(kl);
      if (s.preferred_model) {
        setSelectedModel(s.preferred_model);
      }
    } catch (err: any) {
      console.warn("Could not load key status:", err);
    }
  };

  const handleAddKey = async () => {
    if (!apiKeyInput.trim()) {
      setErrorMsg("Please enter an OpenRouter API key starting with 'sk-or-'.");
      return;
    }
    setIsAddingKey(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const label = keyLabelInput.trim() || `Key ${keysList.length + 1}`;
      await addUserKey(apiKeyInput.trim(), label);
      // Also update preferred model if set
      const newStatus = await saveKey(apiKeyInput.trim(), selectedModel);
      setStatus(newStatus);
      setApiKeyInput("");
      setKeyLabelInput("");
      setSuccessMsg("API key verified and securely added to multi-key vault!");
      const refreshedList = await listUserKeys();
      setKeysList(refreshedList);
      if (onKeyUpdated) onKeyUpdated(newStatus);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add API key.");
    } finally {
      setIsAddingKey(false);
    }
  };

  const handleTestKey = async (keyId?: string, rawKey?: string) => {
    setTestingKeyId(keyId || "manual");
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await testKey(rawKey || undefined);
      if (res.valid) {
        setSuccessMsg(
          `Key verified active! OpenRouter usage: $${(res.usage || 0).toFixed(3)}${
            res.is_free_tier ? " (Free Tier Account)" : ""
          }`
        );
      } else {
        setErrorMsg(res.error || "Key validation failed.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Key test failed.");
    } finally {
      setTestingKeyId(null);
    }
  };

  const handleDeleteIndividualKey = async (keyId: string) => {
    if (!confirm("Remove this API key from your multi-key vault?")) return;
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await deleteUserKey(keyId);
      const refreshedList = await listUserKeys();
      setKeysList(refreshedList);
      const refreshedStatus = await getKeyStatus();
      setStatus(refreshedStatus);
      setSuccessMsg("Key removed from multi-key vault.");
      if (onKeyUpdated) onKeyUpdated(refreshedStatus);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete key.");
    } finally {
      setIsLoading(false);
    }
  };

  const isSelectedModelFree = selectedModel.endsWith(":free");

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" scrollBehavior="inside">
      <ModalContent className="bg-content1 text-foreground border border-divider/80 rounded-2xl shadow-2xl">
        <ModalHeader className="flex items-center gap-2.5 border-b border-divider py-3.5 px-6">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <span className="text-base font-bold text-foreground">OpenRouter Multi-Key BYOK Vault</span>
            <p className="text-[11px] text-default-400 font-normal">
              Zero platform markup • High-availability auto-failover • AES-128 encrypted
            </p>
          </div>
        </ModalHeader>

        <ModalBody className="py-4 px-6 space-y-4">
          {/* Active Keys List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" />
                Configured Keys ({keysList.length})
              </span>
              <span className="text-[11px] text-default-400">
                Rotates automatically on 429 rate limits
              </span>
            </div>

            {keysList.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-divider bg-default-50/50 text-center text-xs text-default-500">
                No keys configured. Add an OpenRouter key below to start running AI market research.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {keysList.map((k) => (
                  <div
                    key={k.key_id}
                    className="p-3 rounded-xl border border-divider bg-content2/60 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-content1 flex items-center justify-center border border-divider shrink-0">
                        <Key className="w-3.5 h-3.5 text-default-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground truncate">{k.label}</span>
                          <span className="font-mono text-[10px] text-default-400">
                            ...{k.last4}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-default-400 mt-0.5">
                          <span>{k.usage_count} calls</span>
                          {k.status === "active" ? (
                            <span className="text-emerald-500 font-medium flex items-center gap-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                              Active
                            </span>
                          ) : (
                            <span className="text-amber-500 font-medium flex items-center gap-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                              {k.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="light"
                        className="h-7 px-2.5 text-[11px] rounded-lg"
                        isLoading={testingKeyId === k.key_id}
                        onPress={() => handleTestKey(k.key_id)}
                      >
                        Test
                      </Button>
                      <Button
                        size="sm"
                        color="danger"
                        variant="light"
                        isIconOnly
                        className="h-7 w-7 rounded-lg text-default-400 hover:text-danger"
                        onPress={() => handleDeleteIndividualKey(k.key_id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Key Section */}
          <div className="p-3.5 rounded-xl border border-divider bg-default-50/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-primary" />
                Add OpenRouter Key
              </span>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline flex items-center gap-1 font-normal text-[11px]"
              >
                Get API key <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input
                size="sm"
                aria-label="Key label"
                placeholder="Key label (e.g. Primary)"
                value={keyLabelInput}
                onValueChange={setKeyLabelInput}
                className="col-span-1"
              />
              <Input
                size="sm"
                aria-label="OpenRouter API Key"
                type={showKey ? "text" : "password"}
                placeholder="sk-or-v1-..."
                value={apiKeyInput}
                onValueChange={setApiKeyInput}
                autoComplete="off"
                spellCheck="false"
                className="col-span-2"
                endContent={
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="text-default-400 hover:text-foreground focus:outline-none"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                color="primary"
                className="rounded-xl font-medium text-xs px-4"
                isLoading={isAddingKey}
                isDisabled={!apiKeyInput.trim()}
                onPress={handleAddKey}
                startContent={!isAddingKey && <Plus className="w-3.5 h-3.5" />}
              >
                Add to Vault
              </Button>
            </div>
          </div>

          {/* Preferred AI Model */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Preferred AI Model</label>
            <Select
              size="sm"
              selectedKeys={[selectedModel]}
              onSelectionChange={(keys) => {
                const val = Array.from(keys)[0] as string;
                if (val) setSelectedModel(val);
              }}
              aria-label="Select AI Model"
              className="w-full"
            >
              {Array.from(new Set([selectedModel, ...models])).map((m) => (
                <SelectItem key={m} textValue={m}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono">{m}</span>
                    {m.endsWith(":free") && (
                      <Chip size="sm" color="success" variant="dot" className="h-5 text-[10px]">
                        FREE
                      </Chip>
                    )}
                  </div>
                </SelectItem>
              ))}
            </Select>

            {!isSelectedModelFree && (
              <div className="text-[11px] text-amber-500 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Paid model selected. Inferences consume credits from your OpenRouter balance.</span>
              </div>
            )}
          </div>

          {/* Feedback Banners */}
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-danger-50 dark:bg-danger-950/30 text-danger text-xs flex items-center gap-2 border border-danger-200 dark:border-danger-800">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded-xl bg-success-50 dark:bg-success-950/30 text-success text-xs flex items-center gap-2 border border-success-200 dark:border-success-800">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </ModalBody>

        <ModalFooter className="border-t border-divider py-3 px-6 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-default-400">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <span>Encrypted at rest with AES-128</span>
          </div>

          <Button size="sm" variant="light" onPress={onClose} className="rounded-xl">
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
