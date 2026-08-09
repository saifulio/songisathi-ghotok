import { useState } from 'react';

// Ported from the SongiSathi design system (components/forms/Button.jsx).
const sizeStyles = {
  sm: { padding: '8px 14px', fontSize: 13 },
  md: { padding: '11px 20px', fontSize: 15 },
  lg: { padding: '14px 26px', fontSize: 16 },
};

const variantStyles = {
  primary: {
    background: 'var(--brand-primary)',
    color: 'var(--text-on-brand)',
    border: '1px solid var(--brand-primary)',
  },
  secondary: {
    background: 'var(--brand-secondary)',
    color: 'var(--text-on-brand)',
    border: '1px solid var(--brand-secondary)',
  },
  outline: {
    background: 'transparent',
    color: 'var(--brand-primary)',
    border: '1px solid var(--border-strong)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--brand-primary)',
    border: '1px solid transparent',
  },
  destructive: {
    background: 'transparent',
    color: 'var(--status-error)',
    border: '1px solid var(--status-error)',
  },
};

const hoverBg = {
  primary: 'var(--brand-primary-hover)',
  secondary: 'var(--brand-secondary-hover)',
  outline: 'var(--surface-card-alt)',
  ghost: 'var(--surface-card-alt)',
  destructive: 'var(--status-error-bg)',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  disabled,
  icon,
  children,
  onClick,
  style,
  type = 'button',
}) {
  const [hover, setHover] = useState(false);
  const base = variantStyles[variant] || variantStyles.primary;
  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontFamily: 'var(--font-sans-body)',
        fontWeight: 600,
        borderRadius: 'var(--radius-md)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition:
          'background var(--duration-fast) var(--ease-standard), opacity var(--duration-fast)',
        opacity: disabled ? 0.45 : 1,
        ...sizeStyles[size],
        ...base,
        background: hover && !disabled ? hoverBg[variant] : base.background,
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}
