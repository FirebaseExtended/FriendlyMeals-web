import {
  FirebaseUIError,
  getTranslation,
  type SignInAuthFormSchema,
} from "@firebase-oss/ui-core";
import {
  useSignInAuthFormAction,
  useSignInAuthFormSchema,
  useUI,
  type SignInAuthFormProps,
} from "@firebase-oss/ui-react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type { SignInAuthFormProps };

export function SignInAuthForm(props: SignInAuthFormProps) {
  const ui = useUI();
  const schema = useSignInAuthFormSchema();
  const action = useSignInAuthFormAction();

  const form = useForm<SignInAuthFormSchema>({
    resolver: standardSchemaResolver(schema),
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: SignInAuthFormSchema) {
    try {
      const credential = await action(values);
      if (credential) {
        props.onSignIn?.(credential);
      }
    } catch (error) {
      const message =
        error instanceof FirebaseUIError ? error.message : String(error);
      form.setError("root", { message });
    }
  }

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-y-4"
      >
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="email">
                {getTranslation(ui, "labels", "emailAddress")}
              </FieldLabel>
              <Input
                {...field}
                id="email"
                type="email"
                aria-invalid={!!fieldState.error}
              />
              {fieldState.error && (
                <FieldError>{fieldState.error.message}</FieldError>
              )}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel
                htmlFor="password"
                className="flex items-center gap-2"
              >
                <span className="grow">
                  {getTranslation(ui, "labels", "password")}
                </span>
                {props.onForgotPasswordClick ? (
                  <Button
                    type="button"
                    variant="link"
                    onClick={props.onForgotPasswordClick}
                    size="sm"
                    className="h-auto p-0"
                  >
                    <span className="text-xs">
                      {getTranslation(ui, "labels", "forgotPassword")}
                    </span>
                  </Button>
                ) : null}
              </FieldLabel>
              <Input
                {...field}
                id="password"
                type="password"
                aria-invalid={!!fieldState.error}
              />
              {fieldState.error && (
                <FieldError>{fieldState.error.message}</FieldError>
              )}
            </Field>
          )}
        />
        <Button type="submit" disabled={ui.state !== "idle"}>
          {getTranslation(ui, "labels", "signIn")}
        </Button>
        {form.formState.errors.root && (
          <FieldError>{form.formState.errors.root.message}</FieldError>
        )}
        {props.onSignUpClick ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={props.onSignUpClick}
          >
            <span className="text-xs">
              {getTranslation(ui, "prompts", "noAccount")}{" "}
              {getTranslation(ui, "labels", "signUp")}
            </span>
          </Button>
        ) : null}
      </form>
    </FormProvider>
  );
}
