/**
 * The switch page's draft: the document being edited, held as the text in the
 * boxes, and the way back to a document. Kept free of React so `npm test` can
 * run it.
 *
 * Types are imported with `import type` only: they are erased, so this file
 * runs under node with nothing else loaded.
 */

import type { SecondUplink, SwitchDocument } from "./get";

/** Physical ports in board order; bond0 is appended when LACP is on. */
const PHYSICAL_PORTS = [
  "node1",
  "node2",
  "node3",
  "node4",
  "bmc",
  "ge0",
  "ge1",
] as const;

/** The one port that has no cable and no link state: the CPU port. */
export const BMC_PORT = "bmc";

/** The LACP bond over ge0 and ge1. Not a switch port, so no link or traffic. */
export const BOND_PORT = "bond0";

/** Rows for the table: with LACP, ge0/ge1 stay visible (locked) and bond0 is added. */
export function portOrder(lag: boolean): string[] {
  return lag ? [...PHYSICAL_PORTS, BOND_PORT] : [...PHYSICAL_PORTS];
}

export function isLag(uplink: SecondUplink): boolean {
  return uplink === "lag";
}

/** ge0 and ge1 under LACP: members of bond0, carrying no VLANs of their own. */
export function isSlave(lag: boolean, name: string): boolean {
  return lag && (name === "ge0" || name === "ge1");
}

/**
 * The document being edited, held as the text that is in the boxes.
 *
 * Text rather than numbers, because a half-typed VLAN list is a legitimate
 * state of a text box and a document that cannot hold it would fight the
 * person typing. Turning it into a document is `documentFrom`, and the one
 * judgement this file makes is whether that succeeds.
 */
export interface PortDraft {
  untagged: string;
  tagged: string;
}

export interface Draft {
  filtering: boolean;
  stp: boolean;
  second_uplink: SecondUplink;
  ports: Record<string, PortDraft>;
  names: Record<string, string>;
}

function emptyPort(): PortDraft {
  return { untagged: "", tagged: "" };
}

export function draftFrom(document: SwitchDocument): Draft {
  // A daemon from before second_uplink existed sends no such key.
  const second_uplink: SecondUplink = document.second_uplink ?? "redundant";
  const ports: Record<string, PortDraft> = {};
  for (const name of portOrder(isLag(second_uplink))) {
    const port = document.ports[name];
    ports[name] = {
      untagged: port?.untagged == null ? "" : String(port.untagged),
      tagged: (port?.tagged ?? []).join(", "),
    };
  }
  return {
    filtering: document.vlan_filtering,
    stp: document.stp,
    second_uplink,
    ports,
    names: { ...(document.names ?? {}) },
  };
}

/**
 * Move the uplink VLANs onto bond0; ge0/ge1 become empty slaves. STP off,
 * because the board refuses LACP with spanning-tree redundancy.
 */
export function withLag(draft: Draft): Draft {
  return {
    ...draft,
    second_uplink: "lag",
    stp: false,
    ports: {
      ...draft.ports,
      ge0: emptyPort(),
      ge1: emptyPort(),
      [BOND_PORT]: { ...draft.ports.ge0 },
    },
  };
}

/**
 * Split bond0 back onto both uplinks as redundant ports. STP back on, because
 * two uplinks into the same network without it are a loop.
 */
export function withoutLag(draft: Draft): Draft {
  const { [BOND_PORT]: bond = emptyPort(), ...ports } = draft.ports;
  return {
    ...draft,
    second_uplink: "redundant",
    stp: true,
    ports: { ...ports, ge0: { ...bond }, ge1: { ...bond } },
  };
}

/** A VLAN number as typed. `null` is "that is not a number". */
function vid(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "" || !/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

/**
 * Which cells do not parse, as `port.field` keys.
 *
 * The only rule this client owns. Whether 4095 is a legal VLAN, whether the
 * BMC may be tagged, whether two uplinks may share a VLAN -- all of that is
 * the board's, asked over the wire on every edit. A copy of those rules here
 * would eventually disagree with the board, and the way that disagreement
 * shows up is a board nobody can reach.
 */
export function unparsed(draft: Draft): Set<string> {
  const bad = new Set<string>();
  for (const name of portOrder(isLag(draft.second_uplink))) {
    const port = draft.ports[name] ?? emptyPort();
    if (port.untagged.trim() !== "" && vid(port.untagged) === null) {
      bad.add(`${name}.untagged`);
    }
    for (const piece of port.tagged.split(",")) {
      if (piece.trim() !== "" && vid(piece) === null) {
        bad.add(`${name}.tagged`);
      }
    }
  }
  return bad;
}

/** The draft as a document, or null while something does not parse. */
export function documentFrom(draft: Draft): SwitchDocument | null {
  if (unparsed(draft).size > 0) return null;

  const ports: SwitchDocument["ports"] = {};
  for (const name of portOrder(isLag(draft.second_uplink))) {
    const port = draft.ports[name] ?? emptyPort();
    const tagged = port.tagged
      .split(",")
      .map((piece) => vid(piece))
      .filter((value): value is number => value !== null);
    ports[name] = {
      untagged: vid(port.untagged),
      tagged: [...new Set(tagged)].sort((a, b) => a - b),
    };
  }

  // An empty name is not a name, and the board refuses one. Dropping it here
  // means clearing a box is how you remove a name, which is what somebody
  // clearing a box means.
  const names: Record<string, string> = {};
  for (const [key, value] of Object.entries(draft.names)) {
    if (value.trim() !== "") names[key] = value.trim();
  }

  return {
    vlan_filtering: draft.filtering,
    stp: draft.stp,
    second_uplink: draft.second_uplink,
    ports,
    names,
  };
}

/** Every VLAN the draft mentions, ascending. What there is to name. */
export function vlansOf(document: SwitchDocument): number[] {
  const seen = new Set<number>();
  for (const port of Object.values(document.ports)) {
    if (port.untagged !== null) seen.add(port.untagged);
    for (const tag of port.tagged) seen.add(tag);
  }
  return [...seen].sort((a, b) => a - b);
}
