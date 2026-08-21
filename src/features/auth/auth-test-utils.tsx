import type {
  ComponentPropsWithoutRef,
  FormEvent,
} from "react";

import type { AuthUser } from "@/contracts";

import type { AuthService } from "./auth-service";

export const AUTH_TEST_USER: AuthUser = {
  id: "00000000-0000-4000-8000-000000000001",
  username: "Movie_Fan",
  email: "user@example.com",
};

export function createAuthService(
  overrides: Partial<AuthService> = {},
): AuthService {
  return {
    register: async () => AUTH_TEST_USER,
    login: async () => AUTH_TEST_USER,
    forgotPassword: async () => undefined,
    resetPassword: async () => undefined,
    ...overrides,
  };
}

type AuthLinkMockProps = Omit<
  ComponentPropsWithoutRef<"a">,
  "href"
> & {
  href: string;
};

export function AuthLinkMock({
  href,
  children,
  ...props
}: AuthLinkMockProps) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

export function invokeFormSubmitHandler(
  form: HTMLFormElement,
): Promise<void> {
  const propsKey = Object.keys(form).find((key) =>
    key.startsWith("__reactProps$"),
  );
  const props = propsKey
    ? (form as unknown as Record<string, unknown>)[propsKey]
    : undefined;
  const onSubmit =
    typeof props === "object" && props !== null
      ? (props as { onSubmit?: unknown }).onSubmit
      : undefined;

  if (typeof onSubmit !== "function") {
    throw new Error("React form submit handler was not found");
  }

  const event = new Event("submit", {
    bubbles: true,
    cancelable: true,
  }) as unknown as FormEvent<HTMLFormElement>;

  return Promise.resolve().then(() =>
    (onSubmit as (
      submitEvent: FormEvent<HTMLFormElement>,
    ) => void | Promise<void>)(event),
  );
}

export const nextLinkMock = {
  default: AuthLinkMock,
};
