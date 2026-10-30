import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = ["ui-btn", `ui-btn-${variant}`, className].filter(Boolean).join(" ");
  return <button className={classes} type={type} {...props} />;
}
