import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BridgeFeeCard } from "@/components/bridge/BridgeFeeCard";
import {
  formatEstimatedTime,
  formatTokenAmount,
} from "@/lib/bridgeFeeQuotes";
import type { BridgeFeeQuoteRequest } from "@/types/bridge";

const fetchMock = vi.fn();

vi.mock("@/lib/bridgeFeeQuotes", async () => {
  const actual = await vi.importActual<typeof import("@/lib/bridgeFeeQuotes")>(
    "@/lib/bridgeFeeQuotes",
  );
  return {
    ...actual,
    fetchBridgeFeeQuote: (req: BridgeFeeQuoteRequest, signal?: AbortSignal) =>
      fetchMock(req, signal),
  };
});

function quoteFor(req: BridgeFeeQuoteRequest) {
  const slow = req.targetNetwork === "ethereum";
  return {
    sourceGasFee: 0.00001,
    sourceGasToken: "XLM",
    relayerServiceFee: Number((req.amount * 0.001).toFixed(6)),
    relayerFeeToken: req.assetCode,
    estimatedTimeMinSeconds: slow ? 300 : 180,
    estimatedTimeMaxSeconds: slow ? 540 : 300,
    quotedAt: new Date().toISOString(),
  };
}

const baseProps = {
  sourceNetwork: "stellar",
  targetNetwork: "polygon",
  assetCode: "USDC",
  amount: "100",
  debounceMs: 0,
  pollMs: 0,
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (req: BridgeFeeQuoteRequest) =>
    quoteFor(req),
  );
});

describe("formatters", () => {
  it("formats the delivery window", () => {
    expect(formatEstimatedTime(180, 300)).toBe("~3-5 minutes");
    expect(formatEstimatedTime(60, 60)).toBe("~1 minute");
  });
  it("formats token amounts without float noise", () => {
    expect(formatTokenAmount(0.00001, "XLM")).toBe("0.00001 XLM");
  });
});

describe("BridgeFeeCard", () => {
  it("shows the itemized breakdown, estimate and clock icon", async () => {
    render(<BridgeFeeCard {...baseProps} />);
    expect(await screen.findByText("0.00001 XLM")).toBeInTheDocument();
    expect(screen.getByText("0.1 USDC")).toBeInTheDocument();
    expect(screen.getByText("~3-5 minutes")).toBeInTheDocument();
    expect(screen.getByText("Source Gas Fee")).toBeInTheDocument();
    expect(screen.getByText("Relayer Service Fee")).toBeInTheDocument();
    expect(screen.getByText("Estimated Time")).toBeInTheDocument();
    expect(screen.getByTestId("bridge-fee-clock")).toBeInTheDocument();
  });

  it("re-quotes when the target network changes", async () => {
    const { rerender } = render(<BridgeFeeCard {...baseProps} />);
    expect(await screen.findByText("~3-5 minutes")).toBeInTheDocument();

    rerender(<BridgeFeeCard {...baseProps} targetNetwork="ethereum" />);
    expect(await screen.findByText("~5-9 minutes")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ targetNetwork: "ethereum" }),
      expect.anything(),
    );
  });

  it("re-quotes when the amount changes", async () => {
    const { rerender } = render(<BridgeFeeCard {...baseProps} />);
    expect(await screen.findByText("0.1 USDC")).toBeInTheDocument();

    rerender(<BridgeFeeCard {...baseProps} amount="5000" />);
    expect(await screen.findByText("5 USDC")).toBeInTheDocument();
    expect(screen.queryByText("0.1 USDC")).not.toBeInTheDocument();
  });

  it("does not request a quote for an empty amount or same-network route", () => {
    const { rerender } = render(<BridgeFeeCard {...baseProps} amount="" />);
    expect(fetchMock).not.toHaveBeenCalled();
    rerender(<BridgeFeeCard {...baseProps} targetNetwork="stellar" />);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aborts the stale request when inputs change mid-flight", async () => {
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation(
      (req: BridgeFeeQuoteRequest, signal: AbortSignal) => {
        signals.push(signal);
        return new Promise(() => {});
      },
    );
    const { rerender } = render(<BridgeFeeCard {...baseProps} />);
    await waitFor(() => expect(signals).toHaveLength(1));
    rerender(<BridgeFeeCard {...baseProps} targetNetwork="ethereum" />);
    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it("explains each fee component in a tooltip on hover", async () => {
    const user = userEvent.setup();
    render(<BridgeFeeCard {...baseProps} />);
    await screen.findByText("~3-5 minutes");

    await user.hover(screen.getByRole("button", { name: "Source Gas Fee" }));
    expect(
      await screen.findByText(/network fee paid on the source chain/i),
    ).toBeInTheDocument();

    await user.hover(
      screen.getByRole("button", { name: "Relayer Service Fee" }),
    );
    expect(
      await screen.findByText(/fee paid to the relayer/i),
    ).toBeInTheDocument();

    await user.hover(screen.getByRole("button", { name: "Estimated Time" }));
    expect(
      await screen.findByText(/how long delivery on the target network/i),
    ).toBeInTheDocument();
  });

  it("shows an error with retry when the quote fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("relayer offline"));
    render(<BridgeFeeCard {...baseProps} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /relayer offline/,
    );
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("~3-5 minutes")).toBeInTheDocument();
  });
});
