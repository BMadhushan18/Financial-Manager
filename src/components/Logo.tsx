export function LogoMark() {
  return (
    <span className="logo-mark" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 18V7l7 7 7-7v11" />
      </svg>
    </span>
  );
}

export function Logo() {
  return (
    <span className="logo">
      <LogoMark />
      MoneyMind
    </span>
  );
}
