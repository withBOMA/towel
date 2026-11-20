"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { buttonStyles, cx } from "@/components/ui";

type Props = ComponentProps<"button"> & {
  variant?: keyof typeof buttonStyles;
  pendingText?: string;
};

/** A submit button that disables itself while its form's Server Action runs. */
export function SubmitButton({ variant = "primary", pendingText, children, className, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      aria-busy={pending}
      className={cx(buttonStyles[variant], className)}
      {...props}
    >
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
