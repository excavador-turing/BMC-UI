import { createLazyFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmationModal from "@/components/ConfirmationModal";
import LoadingButton from "@/components/LoadingButton";
import NodeActions from "@/components/NodeActions";
import NodeLiveness, { NodeLivenessNotes } from "@/components/NodeLiveness";
import NodePowerSwitch, {
  ConfirmationCheckbox,
} from "@/components/NodePowerSwitch";
import NodesSkeleton from "@/components/skeletons/nodes";
import TabView from "@/components/TabView";
import TextField from "@/components/TextField";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useSkipNodeConfirmation } from "@/hooks/useSkipNodeConfirmation";
import { type NodeInfoResponse, useNodesTabData } from "@/lib/api/get";
import { useResetNodeMutation, useSetNodeInfoMutation } from "@/lib/api/set";

export const Route = createLazyFileRoute("/_tabLayout/power-control")({
  component: NodesTab,
  // Every page on this route reads through a suspense query. `pendingComponent`
  // covers a request that is still in flight; a request that FAILS throws
  // during render and passes straight through Suspense, so without this it
  // unwound to the root -- which has no boundary either -- and blanked the
  // application. Info and Network already had one; these three did not.
  errorComponent: () => <div>Error loading Power Control</div>,
  pendingComponent: NodesSkeleton,
});

const NodeRow = (
  props: NodeInfoResponse & {
    nodeId: number;
    editMode: boolean;
  }
) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [showResetDialog, setShowResetDialog] = useState(false);
  // Shared with the power switch, and scoped to this board.
  const [skipConfirmation, rememberSkip] = useSkipNodeConfirmation();
  const [tempSkipConfirmation, setTempSkipConfirmation] = useState(false);

  const { mutate: mutateResetNode, isPending: isPendingReset } =
    useResetNodeMutation();

  const handleResetClick = () => {
    if (skipConfirmation) {
      resetNode();
    } else {
      setTempSkipConfirmation(false); // Reset temporary state
      setShowResetDialog(true);
    }
  };

  const resetNode = () => {
    setShowResetDialog(false);
    mutateResetNode(props.nodeId - 1, {
      onSuccess: () => {
        toast({
          title: t("nodes.powerManagement"),
          description: t("nodes.nodeRestarted", { nodeId: props.nodeId }),
        });

        // Only remembered if the box was ticked.
        if (tempSkipConfirmation) rememberSkip();
      },
      onError: (e) => {
        toast({
          title: t("nodes.pmError"),
          description: e.message,
          variant: "destructive",
        });
      },
    });
  };

  const handleCloseDialog = () => {
    setShowResetDialog(false);
    setTempSkipConfirmation(false);
  };

  return (
    <>
      <Card size="sm">
        <CardHeader>
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>
              {props.name ?? t("nodes.node", { nodeId: props.nodeId })}
            </CardTitle>
            <CardDescription>
              {props.module_name ??
                t("nodes.module", { moduleId: props.nodeId })}
            </CardDescription>
          </div>
          <CardAction className="flex items-center gap-3">
            <NodePowerSwitch
              nodeId={props.nodeId}
              powerOnTime={props.power_on_time}
            />
            <LoadingButton
              type="button"
              variant="destructive"
              onClick={handleResetClick}
              disabled={props.power_on_time === null || isPendingReset}
              isLoading={isPendingReset}
            >
              {t("nodes.restartButton")}
            </LoadingButton>
            <NodeActions nodeId={props.nodeId} />
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {props.editMode ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                type="text"
                name={`node-${props.nodeId}-name`}
                label={t("nodes.nodeName")}
                defaultValue={
                  props.name ?? t("nodes.node", { nodeId: props.nodeId })
                }
              />
              <TextField
                type="text"
                name={`node-${props.nodeId}-module-name`}
                label={t("nodes.moduleName")}
                defaultValue={
                  props.module_name ??
                  t("nodes.module", { moduleId: props.nodeId })
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">{t("nodes.nodeName")}</p>
                <p className="truncate">
                  {props.name ?? t("nodes.node", { nodeId: props.nodeId })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("nodes.moduleName")}</p>
                <p className="truncate">
                  {props.module_name ??
                    t("nodes.module", { moduleId: props.nodeId })}
                </p>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-start">
          <NodeLiveness
            nodeId={props.nodeId}
            powerOnTime={props.power_on_time}
          />
        </CardFooter>
      </Card>

      <ConfirmationModal
        isOpen={showResetDialog}
        onClose={handleCloseDialog}
        title={t("nodes.resetConfirmTitle", { nodeId: props.nodeId })}
        message={
          <>
            <p>
              {t("nodes.resetConfirmDescription", { nodeId: props.nodeId })}
            </p>
            <ConfirmationCheckbox
              checked={tempSkipConfirmation}
              onCheckedChange={setTempSkipConfirmation}
            />
          </>
        }
        onConfirm={resetNode}
      />
    </>
  );
};

export function NodesTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [editMode, setEditMode] = useState(false);
  const { data } = useNodesTabData();
  const { mutate, isPending } = useSetNodeInfoMutation();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;

    const nodeInfo = {
      Node1: {
        name: (form.elements.namedItem("node-1-name") as HTMLInputElement)
          .value,
        module_name: (
          form.elements.namedItem("node-1-module-name") as HTMLInputElement
        ).value,
      },
      Node2: {
        name: (form.elements.namedItem("node-2-name") as HTMLInputElement)
          .value,
        module_name: (
          form.elements.namedItem("node-2-module-name") as HTMLInputElement
        ).value,
      },
      Node3: {
        name: (form.elements.namedItem("node-3-name") as HTMLInputElement)
          .value,
        module_name: (
          form.elements.namedItem("node-3-module-name") as HTMLInputElement
        ).value,
      },
      Node4: {
        name: (form.elements.namedItem("node-4-name") as HTMLInputElement)
          .value,
        module_name: (
          form.elements.namedItem("node-4-module-name") as HTMLInputElement
        ).value,
      },
    };

    mutate(nodeInfo, {
      onSuccess: () => {
        setEditMode(false);
        toast({
          title: t("nodes.saveButton"),
          description: t("nodes.persistSuccess"),
        });
      },
      onError: (e) => {
        toast({
          title: t("nodes.saveButton"),
          description: e.message,
          variant: "destructive",
        });
      },
    });
  };

  return (
    <TabView title={t("nodes.header")}>
      <form onSubmit={handleSubmit} ref={formRef}>
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((node, index) => (
            <NodeRow
              key={index}
              {...node}
              nodeId={index + 1}
              editMode={editMode}
            />
          ))}
        </div>

        <NodeLivenessNotes nodes={data} />

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (editMode) {
                formRef.current?.reset();
              }
              setEditMode(!editMode);
            }}
            disabled={isPending}
          >
            {editMode ? t("ui.cancel") : t("nodes.editButton")}
          </Button>
          <LoadingButton
            type="submit"
            isLoading={isPending}
            disabled={!editMode || isPending}
          >
            {t("nodes.saveButton")}
          </LoadingButton>
        </div>
      </form>
    </TabView>
  );
}
