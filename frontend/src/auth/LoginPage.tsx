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
import { Eye, EyeOff, Lock, User, RefreshCw, Laptop } from "lucide-react";
import { useAuthStore } from "./authStore";
import { useServerWake } from "../wake/useServerWake";

export const LoginPage: React.FC = () => {
  const { login, isLoading, errorNotice, setErrorNotice } = useAuthStore();
  const { status: wakeStatus, elapsedSeconds, retry: retryWake } = useServerWake();

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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      <Card className="max-w-md w-full shadow-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl p-3 sm:p-5">
        <CardHeader className="flex flex-col items-center justify-center pb-2 pt-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-yellow-300 font-black text-xl shadow-md mb-3">
            FK
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Sign in
          </h1>
        </CardHeader>

        <CardBody className="py-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Error / Alert banner */}
            {errorMessage && (
              <Alert
                color={isSessionReplaced ? "warning" : "danger"}
                variant="flat"
                startContent={
                  isSessionReplaced ? (
                    <Laptop className="w-4 h-4 shrink-0" />
                  ) : undefined
                }
                title={errorMessage}
                className="text-xs font-medium"
              />
            )}

            <Input
              label="Username"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              variant="bordered"
              labelPlacement="outside"
              autoComplete="username"
              autoFocus
              disabled={isLoading || isQueuedForWake}
              startContent={<User className="w-4 h-4 text-slate-400 shrink-0" />}
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              variant="bordered"
              labelPlacement="outside"
              autoComplete="current-password"
              disabled={isLoading || isQueuedForWake}
              startContent={<Lock className="w-4 h-4 text-slate-400 shrink-0" />}
              endContent={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="focus:outline-none p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            <Button
              type="submit"
              color="primary"
              size="lg"
              className="w-full font-bold mt-2 shadow-sm"
              isLoading={isLoading || isQueuedForWake}
            >
              {isQueuedForWake ? "Connecting..." : isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardBody>

        <CardFooter className="flex justify-center pt-0 pb-3">
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            Need an account? Contact the owner.
          </p>
        </CardFooter>
      </Card>

      {/* Non-blocking Server Wake Indicator under the card */}
      {(wakeStatus === "waking" || wakeStatus === "checking") && (
        <div className="mt-4 max-w-md w-full px-4 py-3 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm transition-all duration-200">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1.5 font-medium">
            <span>Starting server...</span>
            <span className="font-mono text-[11px]">{elapsedSeconds}s</span>
          </div>
          <Progress
            size="sm"
            isIndeterminate={elapsedSeconds < 2}
            value={Math.min(100, Math.round((elapsedSeconds / 50) * 100))}
            color="primary"
            className="w-full"
          />
        </div>
      )}

      {/* 120s timeout failure notice */}
      {wakeStatus === "failed" && (
        <div className="mt-4 max-w-md w-full px-4 py-3 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/80 dark:bg-rose-950/40 flex items-center justify-between text-xs text-rose-800 dark:text-rose-200">
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
