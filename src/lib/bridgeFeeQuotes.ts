/**
 * Bridge relayer fee & delivery-time quotes.
 *
 * No relayer quote endpoint exists yet, so `fetchBridgeFeeQuote` is mocked
 * against the shape a real relayer API would return — swap the body for a
 * real request once the endpoint lands, without touching the UI or hook that
 * consume it (same approach as `bridgeRefundOps`).
 */
import type { BridgeFeeQuote, BridgeFeeQuoteRequest } from "@/types/bridge";

const MOCK_LATENCY_MS = 300;

/** Typical gas cost for a bridge deposit/claim on each network. */
const NETWORK_GAS: Record<string, { token: string; fee: number }> = {
  stellar: { token: "XLM", fee: 0.00001 },
  ethereum: { token: "ETH", fee: 0.0021 },
  polygon: { token: "MATIC", fee: 0.045 },
  arbitrum: { token: "ETH", fee: 0.00006 },
  bsc: { token: "BNB", fee: 0.0004 },
};

/** Per-network confirmation window (minutes); source + target are summed. */
const NETWORK_FINALITY_MINUTES: Record<string, { min: number; max: number }> = {
  stellar: { min: 1, max: 2 },
  ethereum: { min: 4, max: 6 },
  polygon: { min: 2, max: 3 },
  arbitrum: { min: 2, max: 4 },
  bsc: { min: 2, max: 3 },
};

const DEFAULT_GAS = { token: "ETH", fee: 0.001 };
const DEFAULT_FINALITY = { min: 2, max: 4 };

const RELAYER_FEE_RATE = 0.001; // 0.1% of the bridged amount
const RELAYER_FEE_MINIMUM = 0.05; // in the bridged asset

function abortError(): DOMException {
  return new DOMException("Quote request aborted", "AbortError");
}

export async function fetchBridgeFeeQuote(
  request: BridgeFeeQuoteRequest,
  signal?: AbortSignal,
): Promise<BridgeFeeQuote> {
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, MOCK_LATENCY_MS);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

  const gas = NETWORK_GAS[request.sourceNetwork] ?? DEFAULT_GAS;
  const source =
    NETWORK_FINALITY_MINUTES[request.sourceNetwork] ?? DEFAULT_FINALITY;
  const target =
    NETWORK_FINALITY_MINUTES[request.targetNetwork] ?? DEFAULT_FINALITY;

  const relayerServiceFee = Math.max(
    RELAYER_FEE_MINIMUM,
    Number((request.amount * RELAYER_FEE_RATE).toFixed(6)),
  );

  return {
    sourceGasFee: gas.fee,
    sourceGasToken: gas.token,
    relayerServiceFee,
    relayerFeeToken: request.assetCode,
    estimatedTimeMinSeconds: (source.min + target.min) * 60,
    estimatedTimeMaxSeconds: (source.max + target.max) * 60,
    quotedAt: new Date().toISOString(),
  };
}

/** Formats a delivery window as e.g. `~3-5 minutes`. */
export function formatEstimatedTime(
  minSeconds: number,
  maxSeconds: number,
): string {
  const lo = Math.max(1, Math.round(minSeconds / 60));
  const hi = Math.max(lo, Math.round(maxSeconds / 60));
  const unit = hi === 1 ? "minute" : "minutes";
  return lo === hi ? `~${lo} ${unit}` : `~${lo}-${hi} ${unit}`;
}

/** Formats a token amount without float noise, e.g. `0.00001 XLM`. */
export function formatTokenAmount(value: number, token: string): string {
  const text = value.toLocaleString("en-US", { maximumFractionDigits: 6 });
  return `${text} ${token}`;
}
