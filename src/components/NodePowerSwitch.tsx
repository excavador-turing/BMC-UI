import { useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmationModal from "@/components/ConfirmationModal";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useSkipNodeConfirmation } from "@/hooks/useSkipNodeConfirmation";
import { usePowerNodeMutation } from "@/lib/api/set";

/** The "don't ask again" box, in the power and restart confirmations. */
export function ConfirmationCheckbox({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Field orientation="horizontal" className="pt-4">
      <Checkbox
        id="skipConfirmation"
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next)}
      />
      <FieldLabel htmlFor="skipConfirmation" className="font-normal">
        {t("nodes.dontAskAgain")}
      </FieldLabel>
    </Field>
  );
}

/**
 * A module's power switch, with the confirmation in front of it.
 *
 * One component for the Nodes page and the Dashboard, so the two cannot ask
 * differently -- or one of them not at all -- about cutting power to a
 * machine. The state shown is optimistic: the switch moves when it is
 * confirmed, not when the daemon next reports, which is what the node cards
 * have always done.
 */
export default function NodePowerSwitch({
  nodeId,
  powerOnTime,
}: {
  /** 1-based, as the page shows it. */
  nodeId: number;
  powerOnTime: number | null;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [powerOn, setPowerOn] = useState(powerOnTime !== null);
  const [asking, setAsking] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [skip, remember] = useSkipNodeConfirmation();
  const { mutate, isPending } = usePowerNodeMutation();

  const toggle = () => {
    mutate({ nodeId, powerOn: !powerOn });
    setPowerOn(!powerOn);
    toast({
      title: t("nodes.powerManagement"),
      description: powerOn
        ? t("nodes.nodeOff", { nodeId })
        : t("nodes.nodeOn", { nodeId }),
    });
    setAsking(false);
    if (dontAskAgain) remember();
  };

  return (
    <>
      <Switch
        name={`node-${nodeId}-power`}
        aria-label={t("nodes.ariaNodePowerToggle", { nodeId })}
        disabled={isPending}
        checked={powerOn}
        onCheckedChange={() => {
          if (skip) {
            toggle();
          } else {
            setDontAskAgain(false);
            setAsking(true);
          }
        }}
      />
      <ConfirmationModal
        isOpen={asking}
        onClose={() => {
          setAsking(false);
          setDontAskAgain(false);
        }}
        title={t(
          powerOn ? "nodes.powerOffConfirmTitle" : "nodes.powerOnConfirmTitle",
          { nodeId }
        )}
        message={
          <>
            <p>
              {t(
                powerOn
                  ? "nodes.powerOffConfirmDescription"
                  : "nodes.powerOnConfirmDescription",
                { nodeId }
              )}
            </p>
            <ConfirmationCheckbox
              checked={dontAskAgain}
              onCheckedChange={setDontAskAgain}
            />
          </>
        }
        onConfirm={toggle}
      />
    </>
  );
}
