import { createLazyFileRoute } from "@tanstack/react-router";
import { InfoIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import LoadingButton from "@/components/LoadingButton";
import { NodePicker } from "@/components/NodePicker";
import USBSkeleton from "@/components/skeletons/usb";
import TabView from "@/components/TabView";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useUSBNode1Query, useUSBTabData } from "@/lib/api/get";
import { useUSBModeMutation, useUSBNode1Mutation } from "@/lib/api/set";

export const Route = createLazyFileRoute("/_tabLayout/usb")({
  component: USB,
  // Every page on this route reads through a suspense query. `pendingComponent`
  // covers a request that is still in flight; a request that FAILS throws
  // during render and passes straight through Suspense, so without this it
  // unwound to the root -- which has no boundary either -- and blanked the
  // application. Info and Network already had one; these three did not.
  errorComponent: () => <div>Error loading USB</div>,
  pendingComponent: USBSkeleton,
});

interface SelectOption {
  value: string;
  label: string;
  serverValue?: string;
}

const modeOptions: SelectOption[] = [
  { value: "0", label: "usb.mode.host", serverValue: "Host" },
  { value: "1", label: "usb.mode.device", serverValue: "Device" },
  { value: "2", label: "usb.mode.flash", serverValue: "Flash" },
];

const nodeOptions: SelectOption[] = [
  { value: "0", label: "Node 1" },
  { value: "1", label: "Node 2" },
  { value: "2", label: "Node 3" },
  { value: "3", label: "Node 4" },
];

export function USB() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data } = useUSBTabData();
  const { isPending: isPendingUSBMode, mutateAsync: mutateUSBMode } =
    useUSBModeMutation();
  const { data: usbNode1 } = useUSBNode1Query();
  const { isPending: isPendingUSBNode1, mutateAsync: mutateUSBNode1 } =
    useUSBNode1Mutation();

  const [selectedMode, setSelectedMode] = useState(
    modeOptions.find((option) => option.serverValue === data.mode)?.value ?? ""
  );
  const [selectedNode, setSelectedNode] = useState(
    nodeOptions.find((option) => option.label === data.node)?.value ?? ""
  );
  const [isUsbNode1Checked, setIsUsbNode1Checked] = useState(usbNode1);

  // When the user chooses flash mode for node 1, the checkbox is forced off.
  // Derived rather than pushed into state by an effect, so the value the form
  // submits and the value the checkbox shows cannot disagree for a render.
  const isNode1FlashMode = selectedMode === "2" && selectedNode === "0";
  const usbNode1Value = isUsbNode1Checked && !isNode1FlashMode;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      if (usbNode1 !== usbNode1Value) {
        await mutateUSBNode1({ alternative_port: usbNode1Value });
      }
      await mutateUSBMode({
        node: Number.parseInt(selectedNode),
        mode: Number.parseInt(selectedMode),
      });

      toast({
        title: t("usb.changeSuccessTitle"),
        description: t("usb.changeSuccessMessage"),
      });
    } catch (e) {
      toast({
        title: t("usb.changeFailedTitle"),
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  };

  const modeItems = modeOptions.map((option) => ({
    value: option.value,
    label: t(option.label),
  }));

  // What each mode means, behind a tooltip on its name: a list of three
  // definitions nobody needs twice.
  const definitions = [
    ["usb.mode.host", "usb.mode.hostDefinition", "usb.mode.hostUsage"],
    ["usb.mode.device", "usb.mode.deviceDefinition", "usb.mode.deviceUsage"],
    ["usb.mode.flash", "usb.mode.flashDefinition", "usb.mode.flashUsage"],
  ] as const;

  return (
    <TabView>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("usb.header")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="usb-mode">
                  {t("usb.modeSelect")}
                </FieldLabel>
                <Select
                  name="mode"
                  items={modeItems}
                  value={selectedMode}
                  onValueChange={(value) => setSelectedMode(value ?? "")}
                >
                  <SelectTrigger id="usb-mode" className="w-full">
                    <SelectValue placeholder={t("ui.selectPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {modeItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <NodePicker
                label={t("usb.nodeSelect")}
                name="node"
                value={selectedNode}
                onChange={setSelectedNode}
              />
              {data.bus_type === "Usb hub" && (
                <Field orientation="horizontal">
                  <Checkbox
                    id="usbHub"
                    name="usbHub"
                    checked={usbNode1Value}
                    onCheckedChange={(checked) => setIsUsbNode1Checked(checked)}
                    disabled={isNode1FlashMode}
                  />
                  <FieldLabel
                    htmlFor="usbHub"
                    className="w-fit flex-none font-normal"
                  >
                    {t("usb.mode.usbNode1")}
                  </FieldLabel>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <InfoIcon className="size-4 text-muted-foreground" />
                      }
                    />
                    <TooltipContent sideOffset={8}>
                      <div className="flex max-w-sm flex-col gap-1 text-pretty">
                        <p className="font-medium">{t("usb.mode.usbNode1")}</p>
                        <p>{t("usb.mode.usbNode1Definition")}</p>
                        <p className="font-medium">{t("usb.mode.usageWord")}</p>
                        <p>{t("usb.mode.usbNode1Usage")}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </Field>
              )}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <LoadingButton
                  type="submit"
                  isLoading={isPendingUSBMode || isPendingUSBNode1}
                >
                  {t("usb.submitButton")}
                </LoadingButton>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {t("usb.mode.definitionsTitle")}
                  </span>
                  {definitions.map(([name, definition, usage]) => (
                    <Tooltip key={name}>
                      <TooltipTrigger
                        render={
                          <Badge variant="secondary" className="cursor-help" />
                        }
                      >
                        {t(name)}
                        <InfoIcon data-icon="inline-end" />
                      </TooltipTrigger>
                      <TooltipContent sideOffset={8} align="end">
                        <div className="flex max-w-sm flex-col gap-1 text-pretty">
                          <p className="font-medium">{t(name)}</p>
                          <p>{t(definition)}</p>
                          <p className="font-medium">
                            {t("usb.mode.usageWord")}
                          </p>
                          <p>{t(usage)}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </TabView>
  );
}
