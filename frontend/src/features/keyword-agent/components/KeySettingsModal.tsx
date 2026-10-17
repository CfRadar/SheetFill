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
import { Key, Eye, EyeOff, CheckCircle2, AlertCircle, ExternalLink, Trash2 } from "lucide-react";
import { getKeyStatus, saveKey, deleteKey, testKey, getModels } from "../api";
import type { KeyStatus } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onKeyUpdated?: (status: KeyStatus) => void;
}

export const KeySettingsModal: React.FC<Props> = ({ isOpen, onClose, onKeyUpdated }) => {
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>("meta-llama/llama-3.3-70b-instruct:free");
  const [models, setModels] = useState<string[]>([]);
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadStatusAndModels();
      setApiKeyInput("");
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  const loadStatusAndModels = async () => {
    try {
      const [s, m] = await Promise.all([getKeyStatus(), getModels()]);
      setStatus(s);
      setModels(m.allowed_models || []);
      if (s.preferred_model) {
        setSelectedModel(s.preferred_model);
      }
    } catch (err: any) {
      console.warn("Could not load key status:", err);
    }
  };

  const handleSave = async () => {
    if (!apiKeyInput.trim()) {
      setErrorMsg("Please enter an OpenRouter API key starting with 'sk-or-'.");
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const newStatus = await saveKey(apiKeyInput.trim(), selectedModel);
      setStatus(newStatus);
      setApiKeyInput(""); // Clear immediately from memory
      setSuccessMsg("API key verified and saved successfully!");
      if (onKeyUpdated) onKeyUpdated(newStatus);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save API key.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await testKey(apiKeyInput.trim() || undefined);
      if (res.valid) {
        setSuccessMsg(
          `Key is active! Account usage: $${(res.usage || 0).toFixed(3)}${
            res.is_free_tier ? " (Free Tier Account)" : ""
          }`
        );
      } else {
        setErrorMsg(res.error || "Key validation failed.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Key test failed.");
    } finally {
      setIsTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to remove your stored OpenRouter API key?")) return;
    setIsLoading(true);
    try {
      await deleteKey();
      setStatus({
        configured: false,
        last4: null,
        preferred_model: selectedModel,
        last_verified_at: null,
      });
      setSuccessMsg("Key removed. Keyword Agent generation will be paused until a key is added.");
      if (onKeyUpdated) {
        onKeyUpdated({
          configured: false,
          last4: null,
          preferred_model: selectedModel,
          last_verified_at: null,
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete key.");
    } finally {
      setIsLoading(false);
    }
  };

  const isSelectedModelFree = selectedModel.endsWith(":free");

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalContent className="bg-content1 text-foreground border border-divider">
        <ModalHeader className="flex items-center gap-2 border-b border-divider pb-3">
          <Key className="w-5 h-5 text-primary" />
          <span>OpenRouter BYOK Settings</span>
        </ModalHeader>

        <ModalBody className="py-4 space-y-4">
          <div className="p-3 rounded-lg bg-default-100/60 border border-divider text-xs text-default-600 space-y-1">
            <p className="font-semibold text-foreground">Bring Your Own Key (BYOK) Guarantee:</p>
            <p>
              Your OpenRouter API key is encrypted at rest using AES-128-CBC and is never exposed in plaintext.
              All AI inferences consume credits directly from your personal OpenRouter account.
            </p>
          </div>

          {/* Current Status Badge */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-divider bg-background">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-default-500">Current Key Status</span>
              <div className="flex items-center gap-2">
                {status?.configured ? (
                  <Chip size="sm" color="success" variant="flat" startContent={<CheckCircle2 className="w-3.5 h-3.5" />}>
                    Active (ends in ...{status.last4})
                  </Chip>
                ) : (
                  <Chip size="sm" color="warning" variant="flat" startContent={<AlertCircle className="w-3.5 h-3.5" />}>
                    Not Configured
                  </Chip>
                )}
              </div>
            </div>

            {status?.configured && (
              <Button
                size="sm"
                color="danger"
                variant="light"
                startContent={<Trash2 className="w-4 h-4" />}
                onPress={handleDelete}
                isLoading={isLoading}
              >
                Remove
              </Button>
            )}
          </div>

          {/* Key Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>{status?.configured ? "Replace API Key" : "Enter OpenRouter API Key"}</span>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline flex items-center gap-1 font-normal text-[11px]"
              >
                Get a key <ExternalLink className="w-3 h-3" />
              </a>
            </label>
            <Input
              type={showKey ? "text" : "password"}
              placeholder="sk-or-v1-..."
              value={apiKeyInput}
              onValueChange={setApiKeyInput}
              autoComplete="off"
              spellCheck="false"
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

          {/* Model Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Preferred AI Model</label>
            <Select
              selectedKeys={[selectedModel]}
              onSelectionChange={(keys) => {
                const val = Array.from(keys)[0] as string;
                if (val) setSelectedModel(val);
              }}
              aria-label="Select AI Model"
            >
              {models.map((m) => (
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
                <span>Paid model selected. Inferences will consume credits from your OpenRouter balance.</span>
              </div>
            )}
          </div>

          {/* Feedback Banners */}
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-danger-50 text-danger text-xs flex items-center gap-2 border border-danger-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded-lg bg-success-50 text-success text-xs flex items-center gap-2 border border-success-200">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </ModalBody>

        <ModalFooter className="border-t border-divider pt-3 flex items-center justify-between">
          <Button
            size="sm"
            variant="flat"
            onPress={handleTest}
            isLoading={isTesting}
            isDisabled={!apiKeyInput && !status?.configured}
          >
            Test Key
          </Button>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="light" onPress={onClose}>
              Close
            </Button>
            <Button
              size="sm"
              color="primary"
              onPress={handleSave}
              isLoading={isLoading}
              isDisabled={!apiKeyInput.trim()}
            >
              Save Key
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
