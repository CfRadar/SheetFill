import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Input,
  Button,
  Alert,
  Progress,
} from "@heroui/react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, User, RefreshCw, Laptop, Sun, Moon, Sparkles } from "lucide-react";
import { useAuthStore } from "./authStore";
import { useServerWake } from "../wake/useServerWake";
import { useTheme } from "../ui/theme";

export const LoginPage: React.FC = () => {
  const { login, isLoading, errorNotice, setErrorNotice } = useAuthStore();
  const { status: wakeStatus, elapsedSeconds, retry: retryWake } = useServerWake();
  const { isDark, toggleTheme } = useTheme();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isQueuedForWake, setIsQueuedForWake] = useState(false);

  // Auto-submit if user clicked while waking and server now became ready
  const queuedSubmitRef = useRef(false);

  const executeLogin = async (u: string, p: string) => {
    setLocalError(null);
    setErrorNotice(null);
    try {
      await login(u, p);
    } catch (err: any) {
      setLocalError(err?.message || "Invalid credentials. Please try again.");
    } finally {
      setIsQueuedForWake(false);
      queuedSubmitRef.current = false;
    }
  };

  useEffect(() => {
    if (wakeStatus === "ready" && queuedSubmitRef.current) {
      if (username.trim() && password) {
        executeLogin(username.trim(), password);
      }
    }
  }, [wakeStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setErrorNotice(null);

    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setLocalError("Please enter both username and password.");
      return;
    }

    if (wakeStatus === "waking" || wakeStatus === "checking") {
      setIsQueuedForWake(true);
      queuedSubmitRef.current = true;
      return;
    }

    await executeLogin(cleanUser, password);
  };

  const getErrorMessage = () => {
    if (localError) return localError;
    if (!errorNotice) return null;

    if (errorNotice.code === "SESSION_REPLACED") {
      return "Your account was logged in on another device. Single active device is enforced.";
    }
    if (errorNotice.code === "ACCOUNT_EXPIRED") {
      return "Your subscription has expired. Contact the owner to renew.";
    }
    if (errorNotice.code === "ACCOUNT_DISABLED") {
      return "Your account has been deactivated. Contact the owner.";
    }
    if (errorNotice.code === "INVALID_CREDENTIALS") {
      return "Invalid username or password.";
    }
    return errorNotice.message || "Sign in failed. Please try again.";
  };

  const errorMessage = getErrorMessage();
  const isSessionReplaced = errorNotice?.code === "SESSION_REPLACED";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-background text-foreground transition-colors duration-200"
      style={{
        background: isDark
          ? "radial-gradient(circle at 10% 10%, rgba(99, 102, 241, 0.12) 0%, transparent 45%), #121316"
          : "radial-gradient(circle at 10% 10%, rgba(91, 91, 214, 0.10) 0%, transparent 45%), #F6F7FB",
      }}
    >
      {/* Theme toggle in top right */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          isIconOnly
          size="sm"
          variant="light"
          onPress={toggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className="text-default-500 hover:text-foreground rounded-[10px]"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-default-600" />}
        </Button>
      </div>

      {/* Centered Login Card with 280ms mount transition */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
        className="w-full max-w-[400px]"
      >
        <Card className="w-full shadow-sm border border-divider bg-content1 rounded-[14px] p-2 sm:p-4">
          <CardHeader className="flex flex-col items-center justify-center pb-2 pt-4">
            <div className="w-11 h-11 rounded-[10px] bg-primary flex items-center justify-center text-white shadow-sm mb-2">
              <Sparkles className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Sign in
            </h1>
          </CardHeader>

          <CardBody className="py-3 px-3 sm:px-4">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="Username"
                labelPlacement="outside"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                variant="bordered"
                autoComplete="username"
                autoFocus
                disabled={isLoading || isQueuedForWake}
                startContent={<User className="w-4 h-4 text-default-400 shrink-0" />}
                classNames={{
                  inputWrapper: "h-10 rounded-[10px] border-divider hover:border-default-400",
                  label: "text-[13px] font-medium text-default-600 mb-1",
                  input: "text-sm",
                }}
              />

              <Input
                label="Password"
                labelPlacement="outside"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                variant="bordered"
                autoComplete="current-password"
                disabled={isLoading || isQueuedForWake}
                startContent={<Lock className="w-4 h-4 text-default-400 shrink-0" />}
                endContent={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="focus:outline-none p-1 text-default-400 hover:text-default-600 dark:hover:text-default-200 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                classNames={{
                  inputWrapper: "h-10 rounded-[10px] border-divider hover:border-default-400",
                  label: "text-[13px] font-medium text-default-600 mb-1",
                  input: "text-sm",
                }}
              />

              {/* Error Alert above the button with 200ms animation */}
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Alert
                    color={isSessionReplaced ? "warning" : "danger"}
                    variant="flat"
                    startContent={
                      isSessionReplaced ? (
                        <Laptop className="w-4 h-4 shrink-0" />
                      ) : undefined
                    }
                    title={errorMessage}
                    className="text-xs font-medium rounded-[10px]"
                  />
                </motion.div>
              )}

              <Button
                type="submit"
                color="primary"
                variant="solid"
                className="w-full h-10 font-semibold rounded-[10px] text-sm mt-1 shadow-xs active:scale-[0.98] transition-transform duration-120"
                isLoading={isLoading || isQueuedForWake}
              >
                {isQueuedForWake ? "Connecting..." : isLoading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardBody>

          <CardFooter className="flex justify-center pt-2 pb-4">
            <p className="text-xs text-default-400 text-center">
              Need an account? Contact the owner.
            </p>
          </CardFooter>
        </Card>
      </motion.div>

      {/* Non-blocking Server Wake Indicator under the card */}
      {(wakeStatus === "waking" || wakeStatus === "checking") && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="mt-4 w-full max-w-[400px] px-4 py-3 rounded-[10px] border border-divider bg-content1/80 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between text-xs text-default-500 mb-1.5 font-medium">
            <span>Starting server...</span>
            <span className="font-mono text-[11px]">{elapsedSeconds}s</span>
          </div>
          <Progress
            size="sm"
            isIndeterminate={elapsedSeconds < 2}
            value={Math.min(100, Math.round((elapsedSeconds / 50) * 100))}
            color="primary"
            className="w-full h-1"
          />
        </motion.div>
      )}

      {/* 120s timeout failure notice */}
      {wakeStatus === "failed" && (
        <div className="mt-4 w-full max-w-[400px] px-4 py-3 rounded-[10px] border border-danger-200 dark:border-danger-900/50 bg-danger-50/80 dark:bg-danger-950/40 flex items-center justify-between text-xs text-danger-700 dark:text-danger-300">
          <span>Can't reach the server.</span>
          <Button
            size="sm"
            color="danger"
            variant="flat"
            onPress={retryWake}
            startContent={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
};
