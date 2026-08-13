import { useState } from 'react';
import Button from './Button.jsx';

export { Button };

/* --- Avatar --- */
export function Avatar({ initials, size = 44, tone = 'primary' }) {
  const bg = tone === 'primary' ? 'var(--green-600)' : 'var(--terracotta-500)';
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        color: 'var(--text-on-brand)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-sans-body)',
        fontWeight: 700,
        fontSize: size * 0.38,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

/* --- Card --- */
export function Card({ children, interactive, style, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => interactive && setHover(true)}
      onMouseLeave={() => interactive && setHover(false)}
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: hover ? 'var(--shadow-2)' : 'var(--shadow-1)',
        transition: 'box-shadow var(--duration-normal) var(--ease-standard)',
        padding: 'var(--space-5)',
        fontFamily: 'var(--font-sans-body)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* --- StatusPill --- */
const pillDot = {
  pending: 'var(--status-pending)',
  accepted: 'var(--status-success)',
  declined: 'var(--status-error)',
  expired: 'var(--text-tertiary)',
  active: 'var(--status-success)',
  paused: 'var(--gold-700)',
  draft: 'var(--text-tertiary)',
};
const pillLabel = {
  pending: 'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
  active: 'Active',
  paused: 'Paused',
  draft: 'Draft',
};
export function StatusPill({ status }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--font-sans-body)',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--text-secondary)',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: pillDot[status] || 'var(--text-tertiary)',
        }}
      />
      {pillLabel[status] || status}
    </span>
  );
}

/* --- Badge --- */
const badgeTones = {
  neutral: { bg: 'var(--surface-card-alt)', color: 'var(--text-secondary)' },
  success: { bg: 'var(--status-success-bg)', color: 'var(--status-success)' },
  warning: { bg: 'var(--status-warning-bg)', color: 'var(--status-warning)' },
  error: { bg: 'var(--status-error-bg)', color: 'var(--status-error)' },
  pending: { bg: 'var(--status-pending-bg)', color: 'var(--status-pending)' },
  gold: { bg: 'var(--gold-100)', color: 'var(--gold-700)' },
};
export function Badge({ tone = 'neutral', children, icon, style }) {
  const t = badgeTones[tone] || badgeTones.neutral;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'var(--font-sans-body)',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.03em',
        padding: '4px 10px',
        borderRadius: 'var(--radius-full)',
        background: t.bg,
        color: t.color,
        ...style,
      }}
    >
      {icon}
      {children}
    </span>
  );
}

/* --- ProfileCard --- */
export function ProfileCard({ profileId, name, age, height, education, district, managedBy, verified, photoLocked, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        gap: 14,
        padding: 14,
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: hover ? 'var(--shadow-2)' : 'var(--shadow-1)',
        cursor: 'pointer',
        transition: 'box-shadow var(--duration-normal) var(--ease-standard)',
        fontFamily: 'var(--font-sans-body)',
      }}
    >
      <div style={{ position: 'relative', width: 76, height: 96, borderRadius: 'var(--radius-md)', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,var(--terracotta-200),var(--green-200))', filter: photoLocked ? 'blur(5px)' : 'none' }} />
        {photoLocked && (
          <div style={{ position: 'absolute', inset: 0, background: 'var(--photo-lock-scrim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ivory-050)" strokeWidth="2"><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'var(--font-serif-display)', fontWeight: 600, fontSize: 17, color: 'var(--text-primary)' }}>{name}, {age}</div>
          {verified && <Badge tone="gold">Verified</Badge>}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{height} · {education}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{district}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <span style={{ fontSize: 11, letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>{profileId} · {managedBy}</span>
        </div>
      </div>
    </div>
  );
}

/* --- Tag --- */
export function Tag({ children, onRemove, selected, onClick }) {
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--font-sans-body)',
        fontSize: 13,
        fontWeight: 500,
        padding: '6px 12px',
        borderRadius: 'var(--radius-full)',
        border: '1px solid ' + (selected ? 'var(--brand-primary)' : 'var(--border-default)'),
        background: selected ? 'var(--green-100)' : 'var(--surface-card)',
        color: selected ? 'var(--brand-primary)' : 'var(--text-secondary)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {children}
      {onRemove && (
        <span onClick={onRemove} style={{ cursor: 'pointer', opacity: 0.6 }}>
          ✕
        </span>
      )}
    </span>
  );
}

/* --- IconButton --- */
export function IconButton({ icon, label, active, size = 36, onClick, style }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={label}
      title={label}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-md)',
        border: '1px solid ' + (active ? 'var(--brand-primary)' : 'transparent'),
        background: active
          ? 'var(--green-100)'
          : hover
            ? 'var(--surface-card-alt)'
            : 'transparent',
        color: active ? 'var(--brand-primary)' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'background var(--duration-fast) var(--ease-standard)',
        ...style,
      }}
    >
      {icon}
    </button>
  );
}

/* --- Input --- */
export function Input({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  helper,
  error,
  disabled,
  caption,
  style,
}) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ fontFamily: 'var(--font-sans-body)', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {label}
          {caption && (
            <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--text-tertiary)' }}>
              {caption}
            </span>
          )}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          fontFamily: 'var(--font-sans-body)',
          fontSize: 15,
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
          border:
            '1px solid ' +
            (error ? 'var(--status-error)' : focus ? 'var(--border-focus)' : 'var(--border-default)'),
          background: disabled ? 'var(--surface-sunken)' : 'var(--surface-card)',
          color: 'var(--text-primary)',
          outline: 'none',
          boxShadow: focus ? '0 0 0 3px var(--green-100)' : 'none',
          transition: 'box-shadow var(--duration-fast) var(--ease-standard)',
          ...style,
        }}
      />
      {(helper || error) && (
        <div style={{ fontSize: 12, color: error ? 'var(--status-error)' : 'var(--text-tertiary)' }}>
          {error || helper}
        </div>
      )}
    </div>
  );
}

/* --- Select --- */
export function Select({ label, value, onChange, options = [], placeholder = 'Select…', disabled }) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ fontFamily: 'var(--font-sans-body)', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</label>
      )}
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          fontFamily: 'var(--font-sans-body)',
          fontSize: 15,
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid ' + (focus ? 'var(--border-focus)' : 'var(--border-default)'),
          background: disabled ? 'var(--surface-sunken)' : 'var(--surface-card)',
          color: value ? 'var(--text-primary)' : 'var(--text-tertiary)',
          outline: 'none',
          appearance: 'none',
        }}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* --- Checkbox --- */
export function Checkbox({ label, checked, onChange, disabled }) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        fontFamily: 'var(--font-sans-body)',
        fontSize: 14,
        color: 'var(--text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          border: '1.5px solid ' + (checked ? 'var(--brand-primary)' : 'var(--border-strong)'),
          background: checked ? 'var(--brand-primary)' : 'var(--surface-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background var(--duration-fast)',
        }}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-on-brand)" strokeWidth="3">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </span>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} style={{ display: 'none' }} />
      {label}
    </label>
  );
}

/* --- Radio --- */
export function Radio({ label, checked, onChange, name, disabled }) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        fontFamily: 'var(--font-sans-body)',
        fontSize: 14,
        color: 'var(--text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: '1.5px solid ' + (checked ? 'var(--brand-primary)' : 'var(--border-strong)'),
          background: 'var(--surface-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && (
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--brand-primary)' }} />
        )}
      </span>
      <input type="radio" name={name} checked={checked} onChange={onChange} disabled={disabled} style={{ display: 'none' }} />
      {label}
    </label>
  );
}

/* --- Switch --- */
export function Switch({ label, checked, onChange, disabled }) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        fontFamily: 'var(--font-sans-body)',
        fontSize: 14,
        color: 'var(--text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          width: 38,
          height: 22,
          borderRadius: 'var(--radius-full)',
          background: checked ? 'var(--brand-primary)' : 'var(--border-default)',
          position: 'relative',
          transition: 'background var(--duration-fast) var(--ease-standard)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 18 : 2,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'var(--surface-card)',
            boxShadow: 'var(--shadow-1)',
            transition: 'left var(--duration-fast) var(--ease-standard)',
          }}
        />
      </span>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} style={{ display: 'none' }} />
      {label}
    </label>
  );
}

/* --- Tabs --- */
export function Tabs({ items, active, onChange, style }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        borderBottom: '1px solid var(--border-subtle)',
        fontFamily: 'var(--font-sans-body)',
        ...style,
      }}
    >
      {items.map((it) => {
        const isActive = it.value === active;
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange && onChange(it.value)}
            style={{
              padding: '10px 16px',
              fontSize: 14,
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? 'var(--brand-primary)' : 'var(--text-tertiary)',
              borderBottom: '2px solid ' + (isActive ? 'var(--brand-primary)' : 'transparent'),
              marginBottom: -1,
              transition: 'color var(--duration-fast)',
              whiteSpace: 'nowrap',
            }}
          >
            {it.label}
            {it.count != null && (
              <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>{it.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* --- RangeSlider (dual thumb) --- */
// Two thumbs over one track, for a from–to filter. The thumbs push against
// each other instead of swapping: dragging the low thumb past the high one
// stops it at the high value, which is what a reader expects from a range.
// Styling lives in styles/global.css (.ss-dual-range) — thumbs are pseudo
// elements, so they can't be reached from inline styles.
export function RangeSlider({ min, max, valueMin, valueMax, step = 1, onChange, labelMin, labelMax }) {
  const span = Math.max(1, max - min);
  const lo = ((valueMin - min) / span) * 100;
  const hi = ((valueMax - min) / span) * 100;

  // The high input is later in the DOM, so it wins the hit test where the two
  // overlap. Once both sit in the upper half that would trap the low thumb, so
  // lift it above instead.
  const lowOnTop = lo > 50;

  return (
    <div className="ss-dual-range">
      <div className="ss-dual-range-track" />
      <div className="ss-dual-range-fill" style={{ left: `${lo}%`, width: `${Math.max(0, hi - lo)}%` }} />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueMin}
        aria-label={labelMin || 'Minimum'}
        style={{ zIndex: lowOnTop ? 4 : 2 }}
        onChange={(e) => onChange(Math.min(Number(e.target.value), valueMax), valueMax)}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueMax}
        aria-label={labelMax || 'Maximum'}
        style={{ zIndex: 3 }}
        onChange={(e) => onChange(valueMin, Math.max(Number(e.target.value), valueMin))}
      />
    </div>
  );
}

/* --- Pagination --- */
// Page numbers with the first and last always reachable and a window of one
// either side of the current page; anything skipped collapses to an ellipsis.
// Renders nothing for a single page, so callers can drop it in unconditionally.
export function Pagination({ page, pageCount, onChange }) {
  if (!pageCount || pageCount <= 1) return null;

  const nums = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || (p >= page - 1 && p <= page + 1)) nums.push(p);
  }
  const items = [];
  nums.forEach((p, i) => {
    if (i > 0 && p - nums[i - 1] > 1) items.push({ gap: true, key: `gap-${p}` });
    items.push({ page: p, key: p });
  });

  const base = {
    minWidth: 32,
    height: 32,
    padding: '0 9px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-default)',
    background: 'var(--surface-card)',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-sans-body)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontVariantNumeric: 'tabular-nums',
  };
  const step = (to, label, disabled) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(to)}
      style={{ ...base, opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>
      {step(page - 1, '‹', page <= 1)}
      {items.map((it) =>
        it.gap ? (
          <span key={it.key} style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '0 2px' }}>…</span>
        ) : (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.page)}
            aria-current={it.page === page ? 'page' : undefined}
            style={{
              ...base,
              borderColor: it.page === page ? 'var(--brand-primary)' : 'var(--border-default)',
              background: it.page === page ? 'var(--green-100)' : 'var(--surface-card)',
              color: it.page === page ? 'var(--brand-primary)' : 'var(--text-secondary)',
            }}
          >
            {it.page}
          </button>
        )
      )}
      {step(page + 1, '›', page >= pageCount)}
    </div>
  );
}

/* --- Dialog --- */
export function Dialog({ open, title, children, actions, position = 'fixed' }) {
  if (!open) return null;
  return (
    <div
      style={{
        position,
        inset: 0,
        background: 'var(--surface-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 80,
        padding: 16,
      }}
    >
      <div
        style={{
          width: 'min(420px, 100%)',
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-3)',
          padding: 'var(--space-6)',
          fontFamily: 'var(--font-sans-body)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ fontFamily: 'var(--font-serif-display)', fontWeight: 600, fontSize: 20, color: 'var(--text-primary)' }}>
          {title}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{children}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>{actions}</div>
      </div>
    </div>
  );
}

/* --- Toast --- */
const toastTones = {
  info: { bg: 'var(--surface-inverse)', accent: 'var(--green-400)' },
  success: { bg: 'var(--surface-inverse)', accent: 'var(--green-400)' },
  error: { bg: 'var(--surface-inverse)', accent: 'var(--red-500)' },
};
export function Toast({ tone = 'info', title, message, onClose }) {
  const t = toastTones[tone] || toastTones.info;
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        width: 'min(320px, calc(100vw - 32px))',
        padding: '14px 16px',
        borderRadius: 'var(--radius-lg)',
        background: t.bg,
        color: 'var(--text-on-brand)',
        boxShadow: 'var(--shadow-3)',
        fontFamily: 'var(--font-sans-body)',
        borderLeft: '3px solid ' + t.accent,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
        {message && <div style={{ fontSize: 13, opacity: 0.85, marginTop: 3 }}>{message}</div>}
      </div>
      {onClose && (
        <span onClick={onClose} style={{ cursor: 'pointer', opacity: 0.7 }}>
          ✕
        </span>
      )}
    </div>
  );
}
