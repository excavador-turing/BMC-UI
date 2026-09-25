import { Eye, EyeOff, FileUp } from "lucide-react";
import {
  type ChangeEvent,
  type InputHTMLAttributes,
  type Ref,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label: string;
  type?: string;
  className?: string;
  accept?: string;
  ref?: Ref<HTMLInputElement>;
  /** For a field that is the whole card: the card's title already says it. */
  hideLabel?: boolean;
}

/**
 * A labelled text box: shadcn's `Field` + `FieldLabel` + `Input`.
 *
 * It keeps the old `ui/input` wrapper's props -- `name`, `label`, `type` --
 * because every form here reads its values back by `name` through
 * `form.elements.namedItem`, and a restyle is no reason to move a field's
 * name out from under the code that reads it. The `id` is the `name`, so the
 * label points at it.
 *
 * Two types are special.
 *
 * **password** gets an eye that flips `type`, and nothing else. It used to
 * swallow the caller's `onChange` along with the file case below, and that
 * made every CONTROLLED password field read-only: React reverts each
 * keystroke when a field has `value` and no way to report a change, silently,
 * and the markup looks perfect. That was BMC-Firmware#48, "password setting
 * form does not accept typing in any of the text widgets". So `onChange`
 * always reaches the input here, and `scripts/type-test.py` types into every
 * box the demo shows and fails the build on one that does not keep it.
 *
 * **file** shows the chosen file's name in a read-only box, named
 * `${name}-url`, and puts the real `<input type="file">` beside it under
 * `name` -- which is the field the flash forms read. Clicking the box or the
 * button opens the picker.
 *
 * `defaultValue` goes only to an UNCONTROLLED field: React warns when a field
 * is given both.
 */
export default function TextField({
  name,
  label,
  type = "text",
  className,
  accept,
  defaultValue = "",
  onChange,
  ref,
  hideLabel = false,
  ...props
}: TextFieldProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const controlled = props.value !== undefined;
  const initial = controlled ? {} : { defaultValue };

  if (type === "file") {
    const pick = () => fileRef.current?.click();
    return (
      <Field className={className}>
        <FieldLabel htmlFor={`${name}-url`}>{label}</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id={`${name}-url`}
            name={`${name}-url`}
            value={fileName}
            readOnly
            disabled={props.disabled}
            onClick={pick}
            className="cursor-pointer"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label={t("ui.ariaUploadFile")}
              disabled={props.disabled}
              onClick={pick}
            >
              <FileUp />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <input
          type="file"
          name={name}
          id={name}
          className="hidden"
          ref={fileRef}
          accept={accept}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setFileName(e.target.files?.[0]?.name ?? "");
            onChange?.(e);
          }}
        />
      </Field>
    );
  }

  if (type === "password") {
    return (
      <Field className={className}>
        <FieldLabel htmlFor={name}>{label}</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id={name}
            name={name}
            type={showPassword ? "text" : "password"}
            onChange={onChange}
            ref={ref}
            {...initial}
            {...props}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label={t("ui.ariaPasswordVisibility")}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </Field>
    );
  }

  return (
    <Field className={className}>
      <FieldLabel htmlFor={name} className={cn(hideLabel && "sr-only")}>
        {label}
      </FieldLabel>
      <Input
        id={name}
        name={name}
        type={type}
        onChange={onChange}
        ref={ref}
        {...initial}
        {...props}
      />
    </Field>
  );
}
