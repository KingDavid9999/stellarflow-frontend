"use client";

import React from "react";
import DeFiTooltip from "@/components/ui/DeFiTooltip";
import { useBridgeFeeQuote } from "@/hooks/useBridgeFeeQuote";
import {
  formatEstimatedTime,
  formatTokenAmount,
} from "@/lib/bridgeFeeQuotes";

export interface BridgeFeeCardProps {
  sourceNetwork: string | null;
  targetNetwork: string | null;
  assetCode: string | null;
  /** Raw amount input string. */
  amount: string;
  debounceMs?: number;
  pollMs?: number;
  className?: string;
}

/** Small analog clock whose minute hand sweeps continuously. */
function AnimatedClockIcon() {
  return (
    <span
      aria-hidden="true"
      data-testid="bridge-fee-clock"
      className="relative inline-block h-5 w-5 shrink-0 rounded-full border-2 border-current"
    >
      {/* hour hand */}
      <span className="absolute left-1/2 top-1/2 h-[5px] w-[2px] -translate-x-1/2 -translate-y-full rounded bg-current" />
      {/* minute hand: container spins around the clock centre */}
      <span className="absolute inset-0 animate-spin [animation-duration:4s] motion-reduce:animate-none">
        <span className="absolute left-1/2 top-[1px] h-[7px] w-[2px] -translate-x-1/2 rounded bg-current" />
      </span>
    </span>
  );
}

function ValueSkeleton() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700"
    />
  );
}

export function BridgeFeeCard({
  sourceNetwork,
  targetNetwork,
  assetCode,
  amount,
  debounceMs,
  pollMs,
  className = "",
}: BridgeFeeCardProps) {
  const { status, quote, error, refetch } = useBridgeFeeQuote({
    sourceNetwork,
    targetNetwork,
    assetCode,
    amount,
    debounceMs,
    pollMs,
  });

  const isLoading = status === "loading";

  const renderValue = (text: string | null) => {
    if (isLoading) return <ValueSkeleton />;
    return <span className="font-medium">{text ?? "—"}</span>;
  };

  return (
    <section
      aria-label="Bridge fee estimate"
      className={`rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 ${className}`}
    >
      <dl className="space-y-3" aria-live="polite" aria-busy={isLoading}>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-gray-500 dark:text-gray-400">
            <DeFiTooltip
              title="Source Gas Fee"
              shortDefinition="The network fee paid on the source chain to submit your bridge deposit."
              detailedExplanation="It goes to the source network's validators, not to the bridge, and is charged in that network's native token. It changes with network congestion."
              position="bottom"
            >
              Source Gas Fee
            </DeFiTooltip>
          </dt>
          <dd>
            {renderValue(
              quote
                ? formatTokenAmount(quote.sourceGasFee, quote.sourceGasToken)
                : null,
            )}
          </dd>
        </div>

        <div className="flex items-center justify-between gap-3">
          <dt className="text-gray-500 dark:text-gray-400">
            <DeFiTooltip
              title="Relayer Service Fee"
              shortDefinition="The fee paid to the relayer that delivers your transfer to the target network."
              detailedExplanation="Relayers watch the source chain and submit the claim on the destination for you. The fee covers their destination gas and service cost, and scales with the amount you bridge."
              position="bottom"
            >
              Relayer Service Fee
            </DeFiTooltip>
          </dt>
          <dd>
            {renderValue(
              quote
                ? formatTokenAmount(
                    quote.relayerServiceFee,
                    quote.relayerFeeToken,
                  )
                : null,
            )}
          </dd>
        </div>

        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <AnimatedClockIcon />
            <DeFiTooltip
              title="Estimated Time"
              shortDefinition="How long delivery on the target network is expected to take."
              detailedExplanation="Based on confirmation times on both networks plus relayer processing. It is an estimate; congestion on either chain can make it longer."
              position="bottom"
            >
              Estimated Time
            </DeFiTooltip>
          </dt>
          <dd>
            {renderValue(
              quote
                ? formatEstimatedTime(
                    quote.estimatedTimeMinSeconds,
                    quote.estimatedTimeMaxSeconds,
                  )
                : null,
            )}
          </dd>
        </div>
      </dl>

      {status === "idle" && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Choose different source and target networks and enter an amount to see
          fees.
        </p>
      )}

      {status === "error" && (
        <div
          role="alert"
          className="mt-3 flex items-center justify-between gap-2 text-xs text-red-600 dark:text-red-400"
        >
          <span>Couldn&apos;t load fee estimate. {error}</span>
          <button
            type="button"
            onClick={refetch}
            className="font-semibold underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}
    </section>
  );
}

export default BridgeFeeCard;
