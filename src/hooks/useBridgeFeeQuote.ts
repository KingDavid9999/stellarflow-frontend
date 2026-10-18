"use client";

import { useCallback, useEffect, useState } from "react";
import { useDebounce } from "@/hooks/useDebouncer";
import { fetchBridgeFeeQuote } from "@/lib/bridgeFeeQuotes";
import type { BridgeFeeQuote } from "@/types/bridge";

export interface UseBridgeFeeQuoteParams {
  sourceNetwork: string | null;
  targetNetwork: string | null;
  assetCode: string | null;
  /** Raw amount input; quotes are only requested for a positive number. */
  amount: string;
  /** Delay before an amount edit triggers a new quote. */
  debounceMs?: number;
  /** Background refresh interval while mounted; 0 disables polling. */
  pollMs?: number;
}

export type BridgeFeeQuoteStatus = "idle" | "loading" | "success" | "error";

export interface UseBridgeFeeQuoteResult {
  status: BridgeFeeQuoteStatus;
  quote: BridgeFeeQuote | null;
  error: string | null;
  refetch: () => void;
}

interface QuoteResult {
  key: string;
  quote?: BridgeFeeQuote;
  error?: string;
}

/**
 * Fetches a relayer quote for the chosen route and amount. Re-quotes when the
 * target network or amount change, debounces amount typing, and aborts any
 * in-flight request so a stale quote can never overwrite a newer one.
 */
export function useBridgeFeeQuote({
  sourceNetwork,
  targetNetwork,
  assetCode,
  amount,
  debounceMs = 400,
  pollMs = 15_000,
}: UseBridgeFeeQuoteParams): UseBridgeFeeQuoteResult {
  const debouncedAmount = useDebounce(amount, debounceMs);
  const numericAmount = Number(debouncedAmount);

  const isValid =
    Boolean(sourceNetwork && targetNetwork && assetCode) &&
    sourceNetwork !== targetNetwork &&
    Number.isFinite(numericAmount) &&
    numericAmount > 0;

  const key = `${sourceNetwork}|${targetNetwork}|${assetCode}|${numericAmount}`;
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!isValid || !sourceNetwork || !targetNetwork || !assetCode) return;

    const controller = new AbortController();
    fetchBridgeFeeQuote(
      { sourceNetwork, targetNetwork, assetCode, amount: numericAmount },
      controller.signal,
    )
      .then((quote) => setResult({ key, quote }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : "Failed to fetch bridge quote";
        // A failed background refresh keeps the last good quote on screen.
        setResult((prev) =>
          prev?.key === key && prev.quote ? prev : { key, error: message },
        );
      });

    return () => controller.abort();
  }, [key, isValid, sourceNetwork, targetNetwork, assetCode, numericAmount, nonce]);

  useEffect(() => {
    if (!isValid || !pollMs) return;
    const id = setInterval(() => setNonce((n) => n + 1), pollMs);
    return () => clearInterval(id);
  }, [isValid, pollMs, key]);

  const refetch = useCallback(() => {
    setResult(null);
    setNonce((n) => n + 1);
  }, []);

  if (!isValid) {
    return { status: "idle", quote: null, error: null, refetch };
  }
  // Typing in progress or no result for the current inputs yet: never show a
  // quote that belongs to a different network/amount.
  if (debouncedAmount !== amount || result?.key !== key) {
    return { status: "loading", quote: null, error: null, refetch };
  }
  if (result.error) {
    return { status: "error", quote: null, error: result.error, refetch };
  }
  return {
    status: "success",
    quote: result.quote ?? null,
    error: null,
    refetch,
  };
}
