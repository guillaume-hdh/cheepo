import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  fullWidth?: boolean;
  tone?: "primary" | "secondary" | "ghost";
  children: ReactNode;
};

export default function LoaderButton({
  loading,
  children,
  className = "",
  fullWidth = false,
  tone = "primary",
  ...rest
}: Props) {
  const tones = {
    primary: "btn btn-primary",
    secondary: "btn btn-secondary",
    ghost: "btn btn-ghost",
  };

  return (
    <button
      {...rest}
      disabled={loading || rest.disabled}
      className={[tones[tone], fullWidth ? "btn-block" : "", className].filter(Boolean).join(" ")}
    >
      {loading ? (
        <svg className="loader-button-spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            opacity="0.25"
          />
          <path
            d="M4 12a8 8 0 0 1 8-8"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.75"
          />
        </svg>
      ) : null}
      {children}
    </button>
  );
}
