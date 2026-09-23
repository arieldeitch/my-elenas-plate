/**
 * Explicit weight bridges (DEC-037).
 *
 * A bridge is ONE fact the person or a package label states: "1 <unit> of THIS
 * exact thing weighs N grams". It exists because the canonical reference
 * blocks unit→gram conversion (DEC-036) and blocking is correct — but a real
 * kitchen weighs things, so the person must be able to state the conversion
 * once and reuse it.
 *
 * Hard rules, enforced here and covered by tests:
 *  - a bridge belongs to ONE source identity (a reference group + the row it
 *    was measured on, or one estimated product) and ONE unit;
 *  - it is never applied to another brand / variant / reference identity;
 *  - nothing is inferred: no density table, no "similar food" reuse, no
 *    unit-family maths beyond the gram equivalence the person stated;
 *  - weight units (גרם / ק״ג) never need a bridge and never get one.
 */
import type { PointsSourceKind, Unit, WeightBridge } from "./domain";
import { UNIT_FAMILY, UNIT_TO_GRAMS } from "./points-config";

/** The identity a bridge is attached to. */
export interface BridgeSource {
  kind: PointsSourceKind;
  /** Reference group key, or the estimated product id. */
  key: string;
}

/** Key used by the in-memory index: one bridge per (source, unit). */
export function bridgeKey(source: BridgeSource, unit: Unit): string {
  return `${source.kind}:${source.key}:${unit}`;
}

export type BridgeIndex = Map<string, WeightBridge>;

export function buildBridgeIndex(bridges: Iterable<WeightBridge>): BridgeIndex {
  const index: BridgeIndex = new Map();
  for (const b of bridges) {
    index.set(bridgeKey({ kind: b.sourceKind, key: b.sourceKey }, b.unit), b);
  }
  return index;
}

/** True when the unit is already a weight and needs no bridge at all. */
export function isWeightUnit(unit: Unit): boolean {
  return UNIT_FAMILY[unit] === "weight";
}

export function gramsFromWeightUnit(amount: number, unit: Unit): number {
  return amount * (UNIT_TO_GRAMS[unit] ?? 1);
}

/** The bridge for this exact source + unit, or undefined. Never a near match. */
export function findBridge(
  index: BridgeIndex,
  source: BridgeSource,
  unit: Unit,
): WeightBridge | undefined {
  return index.get(bridgeKey(source, unit));
}

export type GramsResolution =
  | { kind: "weight"; grams: number }
  | { kind: "bridged"; grams: number; bridge: WeightBridge }
  | { kind: "needs_bridge"; unit: Unit }
  | { kind: "invalid_amount" };

/**
 * Grams for an amount of ONE source identity.
 *  - a weight unit converts directly;
 *  - any other unit converts only through an explicit bridge of that identity;
 *  - otherwise the caller must ask for a bridge (never guess).
 */
export function resolveGrams(
  index: BridgeIndex,
  source: BridgeSource,
  amount: number,
  unit: Unit,
): GramsResolution {
  if (!Number.isFinite(amount) || amount <= 0) return { kind: "invalid_amount" };
  if (isWeightUnit(unit)) return { kind: "weight", grams: gramsFromWeightUnit(amount, unit) };
  const bridge = findBridge(index, source, unit);
  if (!bridge) return { kind: "needs_bridge", unit };
  return { kind: "bridged", grams: amount * bridge.gramsPerUnit, bridge };
}

/** The immutable copy stored inside a dish ingredient snapshot. */
export function bridgeSnapshot(bridge: WeightBridge): {
  unit: Unit;
  gramsPerUnit: number;
  provenance: WeightBridge["provenance"];
} {
  return { unit: bridge.unit, gramsPerUnit: bridge.gramsPerUnit, provenance: bridge.provenance };
}

export const BRIDGE_PROVENANCE_LABEL: Record<WeightBridge["provenance"], string> = {
  label: "לפי האריזה",
  user_measured: "נמדד על ידינו",
};

/** "1 כף = 15 גרם" — the one-line explanation shown next to a bridged amount. */
export function describeBridge(bridge: Pick<WeightBridge, "unit" | "gramsPerUnit">): string {
  return `1 ${bridge.unit} = ${bridge.gramsPerUnit} גרם`;
}
