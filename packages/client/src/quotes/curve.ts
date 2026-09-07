import { u64 } from "../amounts.ts";
import { check } from "../errors.ts";

export const FEE_DENOMINATOR = 1_000_000n;
export type CurveState = Readonly<{
  inputReserve: bigint; outputReserve: bigint; tradeFeeRate: bigint;
  creatorFeeRate: bigint; protocolFeeRate: bigint; fundFeeRate: bigint; creatorFeeOnInput: boolean;
}>;
const ceilFee = (amount: bigint, rate: bigint) => (amount * rate + FEE_DENOMINATOR - 1n) / FEE_DENOMINATOR;

export function quoteExactInput(state: CurveState, input: bigint) {
  for (const value of [input, state.inputReserve, state.outputReserve, state.tradeFeeRate, state.creatorFeeRate, state.protocolFeeRate, state.fundFeeRate]) u64(value);
  check(input > 0n && state.inputReserve > 0n && state.outputReserve > 0n, "Quote needs positive input and reserves");
  check(state.tradeFeeRate + state.creatorFeeRate < FEE_DENOMINATOR && state.protocolFeeRate + state.fundFeeRate <= FEE_DENOMINATOR, "Unsupported fee rates");
  const combinedRate = state.tradeFeeRate + state.creatorFeeRate;
  const inputFee = ceilFee(input, state.creatorFeeOnInput ? combinedRate : state.tradeFeeRate);
  const creatorInputFee = state.creatorFeeOnInput && combinedRate > 0n ? inputFee * state.creatorFeeRate / combinedRate : 0n;
  const tradeFee = inputFee - creatorInputFee;
  const netInput = input - inputFee;
  check(netInput > 0n, "Input is consumed by pool fees");
  const grossOutput = netInput * state.outputReserve / (state.inputReserve + netInput);
  const creatorOutputFee = state.creatorFeeOnInput ? 0n : ceilFee(grossOutput, state.creatorFeeRate);
  const output = u64(grossOutput - creatorOutputFee);
  check(output > 0n, "Quote output rounds to zero");
  return Object.freeze({ input, output, tradeFee, creatorInputFee, creatorOutputFee,
    protocolFee: tradeFee * state.protocolFeeRate / FEE_DENOMINATOR, fundFee: tradeFee * state.fundFeeRate / FEE_DENOMINATOR });
}
