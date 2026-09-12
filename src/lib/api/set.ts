import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAxiosWithAuth } from "./_core";
import type { FirmwareSources } from "./get";

interface APIResponse<T> {
  response: {
    result: T;
  }[];
}

interface LoginResponse {
  id: string;
  description: string;
  name: string;
  username: string;
}

export function useLoginMutation() {
  const api = useAxiosWithAuth();

  return useMutation({
    mutationKey: ["loginMutation"],
    mutationFn: async (variables: { username: string; password: string }) => {
      const response = await api.post<LoginResponse>(
        `/bmc/authenticate`,
        variables
      );
      return response.data;
    },
  });
}

export function usePowerNodeMutation() {
  const api = useAxiosWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["nodePowerMutation"],
    mutationFn: async (variables: { nodeId: number; powerOn: boolean }) => {
      const response = await api.get<APIResponse<string>>("/bmc", {
        params: {
          opt: "set",
          type: "power",
          [`node${variables.nodeId}`]: variables.powerOn ? "1" : "0",
        },
      });
      return response.data.response[0].result;
    },
    onSettled: () => {
      // Invalidate the query for the power tab data
      void queryClient.invalidateQueries({ queryKey: ["nodesTabData"] });
    },
  });
}

interface NodePayload {
  name?: string;
  module_name?: string;
}

interface NodeInfoPayload {
  Node1: NodePayload;
  Node2: NodePayload;
  Node3: NodePayload;
  Node4: NodePayload;
}

export function useSetNodeInfoMutation() {
  const api = useAxiosWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["setNodeInfoMutation"],
    mutationFn: async (nodeInfo: NodeInfoPayload) => {
      await api.post<void>("/bmc", nodeInfo, {
        params: {
          opt: "set",
          type: "node_info",
        },
      });
    },
    onSettled: () => {
      // Invalidate the query for the power tab data
      void queryClient.invalidateQueries({ queryKey: ["nodesTabData"] });
    },
  });
}

export function useResetNodeMutation() {
  const api = useAxiosWithAuth();

  return useMutation({
    mutationKey: ["setResetNodeMutation"],
    mutationFn: async (nodeId: number) => {
      const response = await api.get<APIResponse<string>>("/bmc", {
        params: {
          opt: "set",
          type: "reset",
          node: nodeId,
        },
      });
      return response.data.response[0].result;
    },
  });
}

export function useNetworkResetMutation() {
  const api = useAxiosWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["networkResetMutation"],
    mutationFn: async () => {
      const response = await api.get<APIResponse<string>>("/bmc", {
        params: {
          opt: "set",
          type: "network",
          cmd: "reset",
        },
      });
      return response.data.response[0].result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["infoTabData"] });
    },
  });
}

export function useRebootBMCMutation() {
  const api = useAxiosWithAuth();

  return useMutation({
    mutationKey: ["rebootBMCMutation"],
    mutationFn: async () => {
      const response = await api.get<APIResponse<string>>("/bmc", {
        params: {
          opt: "set",
          type: "reboot",
        },
      });
      return response.data.response[0].result;
    },
  });
}

export function useReloadBMCMutation() {
  const api = useAxiosWithAuth();

  return useMutation({
    mutationKey: ["reloadBMCMutation"],
    mutationFn: async () => {
      const response = await api.get<APIResponse<string>>("/bmc", {
        params: {
          opt: "set",
          type: "reload",
        },
      });
      return response.data.response[0].result;
    },
  });
}

export function useUSBModeMutation() {
  const api = useAxiosWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["usbModeMutation"],
    mutationFn: async (variables: { node: number; mode: number }) => {
      const response = await api.get<APIResponse<string>>("/bmc", {
        params: {
          opt: "set",
          type: "usb",
          mode: variables.mode,
          node: variables.node,
        },
      });
      return response.data.response[0].result;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["usbTabData"] });
    },
  });
}

export function useCoolingDeviceMutation() {
  const api = useAxiosWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["coolingDeviceMutation"],
    mutationFn: async (variables: {
      device: string;
      speed: number;
      /**
       * Whether the step is a request or a hold.
       *
       * `manual` pauses the zone's governor first, so the step stays put.
       * `auto` hands the fan back and ignores `speed`. Omitted, the daemon
       * writes the step and leaves the governor running -- which is what
       * this control did before holds existed, and what makes the plain
       * slider a control that lies.
       */
      mode?: "auto" | "manual";
    }) => {
      const response = await api.get<APIResponse<string>>("/bmc", {
        params: {
          opt: "set",
          type: "cooling",
          device: variables.device,
          speed: variables.speed,
          ...(variables.mode ? { mode: variables.mode } : {}),
        },
      });
      return response.data.response[0].result;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["coolingDevices"] });
    },
  });
}

export function useUSBNode1Mutation() {
  const api = useAxiosWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["usbNode1Mutation"],
    mutationFn: async (variables: { alternative_port: boolean }) => {
      const response = await api.get<APIResponse<string>>("/bmc", {
        params: {
          opt: "set",
          type: "usb_node1",
          alternative_port: variables.alternative_port ? "" : null,
        },
      });
      return response.data.response[0].result;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["usbNode1"] });
    },
  });
}

/** Replaces the configured firmware sources. */
export function useSetFirmwareSourcesMutation() {
  const api = useAxiosWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["setFirmwareSources"],
    mutationFn: async (sources: FirmwareSources) => {
      const response = await api.get<APIResponse<FirmwareSources>>("/bmc", {
        params: {
          opt: "set",
          type: "firmware_sources",
          sources: JSON.stringify(sources),
        },
      });
      return response.data.response[0].result;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["firmwareSources"] });
      // The catalogue is derived from the sources, so it is now stale.
      await queryClient.invalidateQueries({ queryKey: ["firmwareAvailable"] });
    },
  });
}

/**
 * Stages a chosen version.
 *
 * The daemon delegates to the same updater the command line uses, so the
 * interface cannot install something `tpi-selfupdate` would refuse.
 */
export function useInstallFirmwareMutation() {
  const api = useAxiosWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["installFirmware"],
    mutationFn: async (variables: {
      source: string;
      version: string;
      allowDowngrade?: boolean;
      /**
       * Set for a candidate the board already holds. An image on the SD card
       * is not fetched, so it does not go through `firmware_install` -- the
       * daemon refuses that pair by design, and posting it was a 400 at the
       * end of a selection that otherwise worked.
       */
      localFile?: string;
    }) => {
      const params = variables.localFile
        ? {
            opt: "set",
            type: "firmware",
            local: 1,
            file: variables.localFile,
          }
        : {
            opt: "set",
            type: "firmware_install",
            source: variables.source,
            version: variables.version,
            ...(variables.allowDowngrade ? { allow_downgrade: 1 } : {}),
          };
      const response = await api.get<APIResponse<unknown>>("/bmc", { params });
      return response.data.response[0].result;
    },
    onSuccess: async () => {
      // The slot panel now has something staged to report.
      await queryClient.invalidateQueries({ queryKey: ["firmwareSlots"] });
    },
  });
}

/**
 * Renames the board.
 *
 * The rename moves the metrics `instance` label with it, so a Prometheus
 * history does not follow the board. That is a decision rather than a side
 * effect, and the card says so before this runs.
 */
export function useSetHostnameMutation() {
  const api = useAxiosWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["setHostname"],
    mutationFn: async (name: string) => {
      const response = await api.get<APIResponse<unknown>>("/bmc", {
        params: { opt: "set", type: "hostname", name },
      });
      return response.data.response[0].result;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["hostname"] });
      // The header shows the name too, and it reads it from `about`.
      await queryClient.invalidateQueries({ queryKey: ["aboutTabData"] });
    },
  });
}

/** Replaces the time sources. An empty list restores the image's own pool. */
export function useSetNtpMutation() {
  const api = useAxiosWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["setNtp"],
    mutationFn: async (servers: string[]) => {
      const response = await api.get<APIResponse<unknown>>("/bmc", {
        params: { opt: "set", type: "ntp", servers: servers.join(",") },
      });
      return response.data.response[0].result;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ntp"] });
    },
  });
}

/** What an import did, field by field. */
export interface ImportReport {
  applied: string[];
  skipped: string[];
  failed: string[];
}

export function useImportConfigMutation() {
  const api = useAxiosWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["importConfig"],
    mutationFn: async (document: string) => {
      const response = await api.get<APIResponse<ImportReport>>("/bmc", {
        params: { opt: "set", type: "config", config: document },
      });
      return response.data.response[0].result;
    },
    onSuccess: async () => {
      // An import can touch any of these, so none of them can be trusted.
      await queryClient.invalidateQueries();
    },
  });
}

/**
 * Change a local account's password (bmcd 2.36.0).
 *
 * The CURRENT password travels with it, always -- the daemon requires it even
 * from an operator a proxy vouched for, because a certificate proves the
 * gateway trusts you rather than that you hold this board's console.
 *
 * Nothing here is cached or logged. `mutationKey` carries no payload and the
 * component keeps the fields in local state that it clears on success.
 */
export function useSetPasswordMutation() {
  const api = useAxiosWithAuth();

  return useMutation({
    mutationKey: ["setPassword"],
    mutationFn: async (body: {
      username: string;
      current_password: string;
      new_password: string;
    }) => {
      await api.post("/bmc/access/password", body);
    },
  });
}

/** Replace the CA whose client certificates may name an operator. */
export function useSetClientCaMutation() {
  const api = useAxiosWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["setClientCa"],
    mutationFn: async (body: { pem: string; identity_header?: string }) => {
      await api.put("/bmc/access/client-ca", body);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["access"] }),
  });
}

/** Stop trusting any proxy. Refused by the daemon when asked THROUGH one. */
export function useRemoveClientCaMutation() {
  const api = useAxiosWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["removeClientCa"],
    mutationFn: async () => {
      await api.delete("/bmc/access/client-ca");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["access"] }),
  });
}
