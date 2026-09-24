import { createLazyFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmationModal from "@/components/ConfirmationModal";
import LoadingButton from "@/components/LoadingButton";
import { NodePicker } from "@/components/NodePicker";
import SdCardPicker from "@/components/SdCardPicker";
import TabView from "@/components/TabView";
import TextField from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import UsageBar from "@/components/UsageBar";
import { useFlash } from "@/hooks/use-flash";
import type { SdCardEntry } from "@/lib/api/get";

export const Route = createLazyFileRoute("/_tabLayout/flash-node")({
  component: FlashNodeRoute,
});

/**
 * The flash form. `preselected` rather than a router search read, because the
 * fleet renders this directly with no router above it; the route wrapper below
 * passes the parsed `?node=`.
 */
export function FlashNode({ preselected }: { preselected?: number }) {
  const { node: fromLink } = { node: preselected };
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedNode, setSelectedNode] = useState<string>(
    fromLink ? String(fromLink - 1) : "0"
  );
  const [confirmFlashModal, setConfirmFlashModal] = useState(false);
  const [picking, setPicking] = useState(false);
  const [fromCard, setFromCard] = useState<SdCardEntry | null>(null);
  const {
    flashType,
    isFlashing,
    statusMessage,
    nodeUpdateMutation,
    uploadProgress,
    handleNodeUpdate,
  } = useFlash();

  const handleSubmit = () => {
    if (formRef.current) {
      setConfirmFlashModal(false);
      const form = formRef.current;

      const nodeId = (form.elements.namedItem("node") as HTMLInputElement)
        .value;
      const file = (form.elements.namedItem("file") as HTMLInputElement)
        .files?.[0];
      // `file-url` is a field this form has not had for several releases, and
      // reading `.value` off the null it returns threw a TypeError before
      // anything was sent -- so the button did nothing, every time, with the
      // failure only in the console. The source a path comes from is state
      // now, not a DOM lookup that can go stale with the markup.
      const url = fromCard?.path;
      const sha256 = (form.elements.namedItem("sha256") as HTMLInputElement)
        .value;
      const skipCRC = (form.elements.namedItem("skipCrc") as HTMLInputElement)
        .checked;

      const parsedNodeId = Number.parseInt(nodeId);

      void handleNodeUpdate({
        nodeId: parsedNodeId,
        file,
        url,
        sha256,
        skipCRC,
      });
    }
  };

  return (
    <TabView>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("flashNode.header")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form ref={formRef}>
            <FieldGroup>
              {/* Preselected from `?node=2` when the Nodes tab sent you here, so
              the node you were looking at is the node this flashes. */}
              <NodePicker
                label={t("flashNode.nodeSelect")}
                name="node"
                value={selectedNode}
                onChange={setSelectedNode}
              />

              <TextField
                type="file"
                name="file"
                label={t("flashNode.fileInput")}
                accept=".img,.bin,.xz,application/octet-stream"
                disabled={fromCard !== null}
              />

              {/* The other source: the board's own SD card. An image is usually
            already there -- staged firmware lands on it, and anyone with
            physical access writes to it directly -- and before this, using
            one meant typing its path from memory. */}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPicking(true)}
                  disabled={nodeUpdateMutation.isPending || isFlashing}
                >
                  {t("sdCard.browse")}
                </Button>
                {fromCard && (
                  <span className="flex items-center gap-2 text-sm">
                    <span className="font-mono break-all">
                      {t("sdCard.chosen", { path: fromCard.path })}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFromCard(null)}
                    >
                      {t("sdCard.clear")}
                    </Button>
                  </span>
                )}
              </div>

              <TextField name="sha256" label={t("flashNode.shaInput")} />

              <Field orientation="horizontal">
                <Checkbox id="skipCrc" name="skipCrc" />
                <FieldLabel htmlFor="skipCrc" className="font-normal">
                  {t("flashNode.skipCrc")}
                </FieldLabel>
              </Field>

              <div>
                {/* Red, by the one colour rule this interface follows: lime means
              safe to press, red means consequential and confirm first. Writing
              an OS image overwrites whatever that module was booting from, and
              it is the single most destructive thing here. It was lime, which
              in this interface is the colour of Save. */}
                <LoadingButton
                  type="button"
                  variant="destructive"
                  onClick={() => setConfirmFlashModal(true)}
                  disabled={nodeUpdateMutation.isPending || isFlashing}
                  isLoading={
                    nodeUpdateMutation.isPending ||
                    (isFlashing && flashType === "node")
                  }
                >
                  {t("flashNode.submitButton")}
                </LoadingButton>
              </div>

              {uploadProgress && flashType === "node" && (
                <UsageBar
                  aria-label={t("flashNode.ariaProgress")}
                  value={uploadProgress.pct}
                  label={`${uploadProgress.transferred}${uploadProgress.total ? ` / ${uploadProgress.total}` : ""}`}
                  pulsing={nodeUpdateMutation.isPending || isFlashing}
                />
              )}
              {flashType === "node" && statusMessage && (
                <div className="text-sm">{statusMessage}</div>
              )}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <SdCardPicker
        isOpen={picking}
        onClose={() => setPicking(false)}
        onChoose={setFromCard}
      />
      <ConfirmationModal
        isOpen={confirmFlashModal}
        onClose={() => setConfirmFlashModal(false)}
        onConfirm={handleSubmit}
        title={t("flashNode.flashModalTitle")}
        message={t("flashNode.flashModalDescription")}
      />
    </TabView>
  );
}

/** The routed form: parse `?node=` here, hand it down as a prop. */
function FlashNodeRoute() {
  const { node } = Route.useSearch();
  return <FlashNode preselected={node} />;
}
