import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
};

export default function LoaderButton({ loading, children, className = "", ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={loading || rest.disabled}
      className={
        "inline-flex items-center gap-2 rounded-lg px-4 py-2 font-medium " +
        "bg-cheepo-coral text-white shadow-sm hover:bg-cheepo-coralHover " +
        "disabled:opacity-60 disabled:cursor-not-allowed " + className
      }
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
        </svg>
      )}
      {children}
    </button>
  );
}
