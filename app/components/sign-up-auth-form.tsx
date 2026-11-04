import {
  FirebaseUIError,
  getTranslation,
  type SignUpAuthFormSchema,
} from "@firebase-oss/ui-core";
import {
  useRequireDisplayName,
  useSignUpAuthFormAction,
  useSignUpAuthFormSchema,
  useUI,
  type SignUpAuthFormProps,
} from "@firebase-oss/ui-react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Policies } from "@/components/policies";

export type { SignUpAuthFormProps };

export function SignUpAuthForm(props: SignUpAuthFormProps) {
  const ui = useUI();
  const schema = useSignUpAuthFormSchema();
  const action = useSignUpAuthFormAction();
  const requireDisplayName = useRequireDisplayName();

  const form = useForm<SignUpAuthFormSchema>({
    resolver: standardSchemaResolver(schema),
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
      displayName: requireDisplayName ? "" : undefined,
    },
  });

  async function onSubmit(values: SignUpAuthFormSchema) {
    try {
      const credential = await action(values);
      props.onSignUp?.(credential);
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
        {requireDisplayName ? (
          <Controller
            control={form.control}
            name="displayName"
            render={({ field, fieldState }) => (
              <Field data-invalid={!!fieldState.error}>
                <FieldLabel htmlFor="displayName">
                  {getTranslation(ui, "labels", "displayName")}
                </FieldLabel>
                <Input
                  {...field}
                  id="displayName"
                  aria-invalid={!!fieldState.error}
                />
                {fieldState.error && (
                  <FieldError>{fieldState.error.message}</FieldError>
                )}
              </Field>
            )}
          />
        ) : null}
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
              <FieldLabel htmlFor="password">
                {getTranslation(ui, "labels", "password")}
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
        <Policies />
        <Button type="submit" disabled={ui.state !== "idle"}>
          {getTranslation(ui, "labels", "createAccount")}
        </Button>
        {form.formState.errors.root && (
          <FieldError>{form.formState.errors.root.message}</FieldError>
        )}
        {props.onSignInClick ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={props.onSignInClick}
          >
            <span className="text-xs">
              {getTranslation(ui, "prompts", "haveAccount")}{" "}
              {getTranslation(ui, "labels", "signIn")}
            </span>
          </Button>
        ) : null}
      </form>
    </FormProvider>
  );
}
