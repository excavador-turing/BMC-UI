import { Eye, EyeOff, FileUp } from "lucide-react";
import { forwardRef, type InputHTMLAttributes, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label: string;
  type?: string;
  className?: string;
  accept?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      name,
      label,
      type = "text",
      className = "",
      accept,
      defaultValue = "",
      disabled = false,
      onChange,
      ...props
    },
    ref
  ) => {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showPassword, setShowPassword] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];

      if (inputRef.current) {
        inputRef.current.value = file ? file.name : "";
      }

      if (onChange) {
        onChange(e);
      }
    };

    const isFileInput = type === "file";
    const isPasswordInput = type === "password";

    // A FILE input keeps its own handler: the visible box shows the chosen
    // file's name and is written by `handleFileChange` on the hidden input
    // beside it, so passing the caller's `onChange` here would fire twice.
    // A PASSWORD input was in that same clause and had no business being
    // there -- the eye button only flips `type`, and nothing else about a
    // password box is special. Dropping its `onChange` made every
    // CONTROLLED password field read-only: React reverts each keystroke
    // when a field has `value` and no way to report a change, silently, and
    // the markup looks perfect. That is BMC-Firmware#48, "password setting
    // form does not accept typing in any of the text widgets" -- all three
    // boxes of the password form, and the factory-password page that a
    // board shows before it will do anything else. Login was unaffected
    // because it reads the DOM on submit rather than holding state, which
    // is why this survived since the Tailwind move (#6).
    //
    // `scripts/type-test.py` types into every box the demo shows and fails
    // the build on one that does not keep what was typed.
    //
    // `defaultValue` is passed only to an UNCONTROLLED field, for the same
    // family of reasons: React warns when a field is given both, and the
    // component used to hand every caller a `defaultValue` of "" whether
    // they controlled the field or not.
    const controlled = props.value !== undefined;

    return (
      <label className={`relative block ${className}`}>
        <input
          type={isFileInput || showPassword ? "text" : type}
          id={`${name}${isFileInput ? "-url" : ""}`}
          name={`${name}${isFileInput ? "-url" : ""}`}
          {...(controlled ? {} : { defaultValue })}
          disabled={disabled}
          onChange={isFileInput ? undefined : onChange}
          placeholder=" "
          className="peer block w-full appearance-none rounded-md border border-neutral-200 px-4 pt-5 pb-1.5 text-sm font-semibold placeholder:text-transparent focus:border-transparent focus:ring-2 focus:ring-black focus:outline-hidden disabled:border-white disabled:bg-white disabled:pt-3 disabled:pb-3.5 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:ring-white dark:disabled:border-neutral-800 dark:disabled:bg-neutral-900"
          ref={ref ?? inputRef}
          {...props}
        />

        <span className="absolute top-0 left-0 origin-left -translate-y-2 px-4 py-3 text-sm font-semibold opacity-60 duration-200 ease-in-out peer-placeholder-shown:translate-y-0 peer-focus:-translate-y-2 peer-disabled:hidden">
          {label}
        </span>
        {disabled && <span className="sr-only">{label}</span>}

        {isFileInput && (
          <>
            <button
              type="button"
              aria-label={t("ui.ariaUploadFile")}
              className="absolute top-1/2 right-4 flex -translate-y-1/2 cursor-pointer items-center justify-center"
              onClick={() => {
                fileInputRef.current?.click();
              }}
            >
              <FileUp className="size-6 opacity-60" />
            </button>
            <input
              type="file"
              name={name}
              id={name}
              className="hidden"
              ref={fileInputRef}
              accept={accept}
              onChange={handleFileChange}
            />
          </>
        )}

        {isPasswordInput && (
          <button
            type="button"
            aria-label={t("ui.ariaPasswordVisibility")}
            className="absolute top-1/2 right-4 flex -translate-y-1/2 cursor-pointer items-center justify-center"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff className="size-6 opacity-60" />
            ) : (
              <Eye className="size-6 opacity-60" />
            )}
          </button>
        )}
      </label>
    );
  }
);

Input.displayName = "Input";

export { Input };
