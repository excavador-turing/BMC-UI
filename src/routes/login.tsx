import { createFileRoute, redirect } from "@tanstack/react-router";
import { type AxiosError } from "axios";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import LoadingButton from "@/components/LoadingButton";
import SiteFooter from "@/components/SiteFooter";
import TextField from "@/components/TextField";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { useAuth } from "@/hooks/useAuth";
import { useLoginMutation } from "@/lib/api/set";

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated) {
      const redirectPath = (search as { redirect: string }).redirect || "/info";
      redirect({ to: redirectPath, throw: true });
    }
  },
  component: Login,
});

export function Login() {
  const { t } = useTranslation();
  const { mutate: mutateLogin, isPending } = useLoginMutation();
  const [message, setMessage] = useState("");
  const { login } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const username = (form.elements.namedItem("username") as HTMLInputElement)
      .value;
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;
    const rememberMe = (
      form.elements.namedItem("rememberMe") as HTMLInputElement
    ).checked;

    mutateLogin(
      { username, password },
      {
        onSuccess: (data) => {
          setMessage("");
          login(username, data.id, rememberMe);

          // force refresh the same page, natively
          window.location.reload();
        },
        onError: (error) => {
          const msg =
            (error as AxiosError).code === "ERR_BAD_REQUEST"
              ? t("login.errorCredentials")
              : t("login.errorUnknown");
          setMessage(msg);
        },
      }
    );
  };

  return (
    <>
      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl">{t("login.header")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <TextField
                  type="text"
                  autoCorrect="off"
                  autoCapitalize="off"
                  autoComplete="username"
                  name="username"
                  label={t("login.username")}
                />
                <TextField
                  type="password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  autoComplete="current-password"
                  name="password"
                  label={t("login.password")}
                />
                <Field orientation="horizontal">
                  <Checkbox id="rememberMe" name="rememberMe" />
                  <FieldLabel htmlFor="rememberMe" className="font-normal">
                    {t("login.remember")}
                  </FieldLabel>
                </Field>
                <LoadingButton
                  type="submit"
                  size="lg"
                  className="w-full"
                  isLoading={isPending}
                >
                  {t("login.submit")}
                </LoadingButton>
                <FieldError id="responseMessage">{message}</FieldError>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </>
  );
}
