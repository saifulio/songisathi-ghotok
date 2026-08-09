/* @ds-bundle: {"format":4,"namespace":"SongiSathiDesignSystem_d7ffd3","components":[{"name":"Avatar","sourcePath":"components/data-display/Avatar.jsx"},{"name":"Card","sourcePath":"components/data-display/Card.jsx"},{"name":"ProfileCard","sourcePath":"components/data-display/ProfileCard.jsx"},{"name":"StatusPill","sourcePath":"components/data-display/StatusPill.jsx"},{"name":"Badge","sourcePath":"components/feedback/Badge.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"Tag","sourcePath":"components/feedback/Tag.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Button","sourcePath":"components/forms/Button.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"IconButton","sourcePath":"components/forms/IconButton.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/data-display/Avatar.jsx":"16331e1b26b1","components/data-display/Card.jsx":"ca69d19706a5","components/data-display/ProfileCard.jsx":"4fdb12198983","components/data-display/StatusPill.jsx":"56e9c9485a42","components/feedback/Badge.jsx":"1918d70a3462","components/feedback/Dialog.jsx":"d13b22028bd0","components/feedback/Tag.jsx":"2e4d3d17e5a3","components/feedback/Toast.jsx":"cb8615600c81","components/feedback/Tooltip.jsx":"2a578d097852","components/forms/Button.jsx":"d07e94664582","components/forms/Checkbox.jsx":"703eda1c9806","components/forms/IconButton.jsx":"5a2e92274956","components/forms/Input.jsx":"6e5062d865f5","components/forms/Radio.jsx":"dff078464b4f","components/forms/Select.jsx":"dcf187d28f2c","components/forms/Switch.jsx":"81bc4c168230","components/navigation/Tabs.jsx":"64b725508e98","ui_kits/member-app/App.jsx":"e7cc313a3809","ui_kits/member-app/Chat.jsx":"1ab4a35f0449","ui_kits/member-app/Dashboard.jsx":"7186b223fe25","ui_kits/member-app/Discover.jsx":"7b425d81de73","ui_kits/member-app/InterestInbox.jsx":"6a88ebcdad1e","ui_kits/member-app/Login.jsx":"1d1287845c2c","ui_kits/member-app/ProfileDetail.jsx":"10fc0d246e04","ui_kits/member-app/Shell.jsx":"d8fd06bd041f"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.SongiSathiDesignSystem_d7ffd3 = window.SongiSathiDesignSystem_d7ffd3 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/data-display/Avatar.jsx
try { (() => {
function Avatar({
  initials,
  size = 44,
  tone = 'primary'
}) {
  const bg = tone === 'primary' ? 'var(--green-600)' : 'var(--terracotta-500)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
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
      flexShrink: 0
    }
  }, initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Card.jsx
try { (() => {
function Card({
  children,
  interactive,
  style,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => interactive && setHover(true),
    onMouseLeave: () => interactive && setHover(false),
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: hover ? 'var(--shadow-2)' : 'var(--shadow-1)',
      transition: 'box-shadow var(--duration-normal) var(--ease-standard)',
      padding: 'var(--space-5)',
      fontFamily: 'var(--font-sans-body)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Card.jsx", error: String((e && e.message) || e) }); }

// components/data-display/StatusPill.jsx
try { (() => {
const dot = {
  pending: 'var(--status-pending)',
  accepted: 'var(--status-success)',
  declined: 'var(--status-error)',
  expired: 'var(--text-tertiary)',
  active: 'var(--status-success)',
  paused: 'var(--gold-700)',
  draft: 'var(--text-tertiary)'
};
const label = {
  pending: 'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
  active: 'Active',
  paused: 'Paused',
  draft: 'Draft'
};
function StatusPill({
  status
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: 'var(--font-sans-body)',
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--text-secondary)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: dot[status] || 'var(--text-tertiary)'
    }
  }), label[status] || status);
}
Object.assign(__ds_scope, { StatusPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/StatusPill.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Badge.jsx
try { (() => {
const tones = {
  neutral: {
    bg: 'var(--surface-card-alt)',
    color: 'var(--text-secondary)'
  },
  success: {
    bg: 'var(--status-success-bg)',
    color: 'var(--status-success)'
  },
  warning: {
    bg: 'var(--status-warning-bg)',
    color: 'var(--status-warning)'
  },
  error: {
    bg: 'var(--status-error-bg)',
    color: 'var(--status-error)'
  },
  pending: {
    bg: 'var(--status-pending-bg)',
    color: 'var(--status-pending)'
  },
  gold: {
    bg: 'var(--gold-100)',
    color: 'var(--gold-700)'
  }
};
function Badge({
  tone = 'neutral',
  children,
  icon
}) {
  const t = tones[tone] || tones.neutral;
  return /*#__PURE__*/React.createElement("span", {
    style: {
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
      color: t.color
    }
  }, icon, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Badge.jsx", error: String((e && e.message) || e) }); }

// components/data-display/ProfileCard.jsx
try { (() => {
function ProfileCard({
  profileId,
  name,
  age,
  height,
  education,
  district,
  managedBy,
  verified,
  photoLocked,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      gap: 14,
      padding: 14,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: hover ? 'var(--shadow-2)' : 'var(--shadow-1)',
      cursor: 'pointer',
      transition: 'box-shadow var(--duration-normal) var(--ease-standard)',
      fontFamily: 'var(--font-sans-body)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 76,
      height: 96,
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(135deg,var(--terracotta-200),var(--green-200))',
      filter: photoLocked ? 'blur(5px)' : 'none'
    }
  }), photoLocked && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--photo-lock-scrim)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--ivory-050)",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "4",
    y: "11",
    width: "16",
    height: "9",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 11V7a4 4 0 0 1 8 0v4"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-serif-display)',
      fontWeight: 600,
      fontSize: 17,
      color: 'var(--text-primary)'
    }
  }, name, ", ", age), verified && /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "gold"
  }, "Verified")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-secondary)'
    }
  }, height, " \xB7 ", education), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-secondary)'
    }
  }, district), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      letterSpacing: '0.06em',
      color: 'var(--text-tertiary)'
    }
  }, profileId, " \xB7 ", managedBy))));
}
Object.assign(__ds_scope, { ProfileCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/ProfileCard.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
function Dialog({
  open,
  title,
  children,
  onClose,
  actions
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--surface-overlay)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 380,
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-3)',
      padding: 'var(--space-6)',
      fontFamily: 'var(--font-sans-body)',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-serif-display)',
      fontWeight: 600,
      fontSize: 20,
      color: 'var(--text-primary)'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--text-secondary)',
      lineHeight: 1.55
    }
  }, children), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      justifyContent: 'flex-end',
      marginTop: 6
    }
  }, actions)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tag.jsx
try { (() => {
function Tag({
  children,
  onRemove,
  selected
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
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
      color: selected ? 'var(--brand-primary)' : 'var(--text-secondary)'
    }
  }, children, onRemove && /*#__PURE__*/React.createElement("span", {
    onClick: onRemove,
    style: {
      cursor: 'pointer',
      opacity: 0.6
    }
  }, "\u2715"));
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tag.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
const tones = {
  info: {
    bg: 'var(--surface-inverse)',
    accent: 'var(--green-400)'
  },
  success: {
    bg: 'var(--surface-inverse)',
    accent: 'var(--green-400)'
  },
  error: {
    bg: 'var(--surface-inverse)',
    accent: 'var(--red-500)'
  }
};
function Toast({
  tone = 'info',
  title,
  message,
  onClose
}) {
  const t = tones[tone] || tones.info;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
      width: 320,
      padding: '14px 16px',
      borderRadius: 'var(--radius-lg)',
      background: t.bg,
      color: 'var(--text-on-brand)',
      boxShadow: 'var(--shadow-3)',
      fontFamily: 'var(--font-sans-body)',
      borderLeft: '3px solid ' + t.accent
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 14
    }
  }, title), message && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      opacity: 0.85,
      marginTop: 3
    }
  }, message)), onClose && /*#__PURE__*/React.createElement("span", {
    onClick: onClose,
    style: {
      cursor: 'pointer',
      opacity: 0.7
    }
  }, "\u2715"));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
function Tooltip({
  label,
  children
}) {
  const [show, setShow] = React.useState(false);
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex'
    },
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false)
  }, children, show && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      bottom: '120%',
      left: '50%',
      transform: 'translateX(-50%)',
      whiteSpace: 'nowrap',
      background: 'var(--surface-inverse)',
      color: 'var(--text-on-brand)',
      fontFamily: 'var(--font-sans-body)',
      fontSize: 12,
      padding: '6px 10px',
      borderRadius: 'var(--radius-sm)',
      boxShadow: 'var(--shadow-2)',
      zIndex: 10
    }
  }, label));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Button.jsx
try { (() => {
const sizeStyles = {
  sm: {
    padding: '8px 14px',
    fontSize: 13
  },
  md: {
    padding: '11px 20px',
    fontSize: 15
  },
  lg: {
    padding: '14px 26px',
    fontSize: 16
  }
};
const variantStyles = {
  primary: {
    background: 'var(--brand-primary)',
    color: 'var(--text-on-brand)',
    border: '1px solid var(--brand-primary)'
  },
  secondary: {
    background: 'var(--brand-secondary)',
    color: 'var(--text-on-brand)',
    border: '1px solid var(--brand-secondary)'
  },
  outline: {
    background: 'transparent',
    color: 'var(--brand-primary)',
    border: '1px solid var(--border-strong)'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--brand-primary)',
    border: '1px solid transparent'
  },
  destructive: {
    background: 'transparent',
    color: 'var(--status-error)',
    border: '1px solid var(--status-error)'
  }
};
const hoverBg = {
  primary: 'var(--brand-primary-hover)',
  secondary: 'var(--brand-secondary-hover)',
  outline: 'var(--surface-card-alt)',
  ghost: 'var(--surface-card-alt)',
  destructive: 'var(--status-error-bg)'
};
function Button({
  variant = 'primary',
  size = 'md',
  disabled,
  icon,
  children,
  onClick,
  style
}) {
  const [hover, setHover] = React.useState(false);
  const base = variantStyles[variant] || variantStyles.primary;
  return /*#__PURE__*/React.createElement("button", {
    onClick: disabled ? undefined : onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    disabled: disabled,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: 'var(--font-sans-body)',
      fontWeight: 600,
      borderRadius: 'var(--radius-md)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background var(--duration-fast) var(--ease-standard), opacity var(--duration-fast)',
      opacity: disabled ? 0.45 : 1,
      ...sizeStyles[size],
      ...base,
      background: hover && !disabled ? hoverBg[variant] : base.background,
      ...style
    }
  }, icon, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Button.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function Checkbox({
  label,
  checked,
  onChange,
  disabled
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      fontFamily: 'var(--font-sans-body)',
      fontSize: 14,
      color: 'var(--text-primary)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 18,
      height: 18,
      borderRadius: 5,
      border: '1.5px solid ' + (checked ? 'var(--brand-primary)' : 'var(--border-strong)'),
      background: checked ? 'var(--brand-primary)' : 'var(--surface-card)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background var(--duration-fast)'
    }
  }, checked && /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--text-on-brand)",
    strokeWidth: "3"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20 6L9 17l-5-5"
  }))), /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: checked,
    onChange: onChange,
    disabled: disabled,
    style: {
      display: 'none'
    }
  }), label);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/IconButton.jsx
try { (() => {
function IconButton({
  icon,
  label,
  active,
  size = 36,
  onClick,
  style
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    "aria-label": label,
    title: label,
    style: {
      width: size,
      height: size,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 'var(--radius-md)',
      border: '1px solid ' + (active ? 'var(--brand-primary)' : 'transparent'),
      background: active ? 'var(--green-100)' : hover ? 'var(--surface-card-alt)' : 'transparent',
      color: active ? 'var(--brand-primary)' : 'var(--text-secondary)',
      cursor: 'pointer',
      transition: 'background var(--duration-fast) var(--ease-standard)',
      ...style
    }
  }, icon);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function Input({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  helper,
  error,
  disabled,
  caption
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans-body)',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--text-primary)'
    }
  }, label, caption && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 8,
      fontWeight: 400,
      color: 'var(--text-tertiary)'
    }
  }, caption)), /*#__PURE__*/React.createElement("input", {
    type: type,
    placeholder: placeholder,
    value: value,
    onChange: onChange,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      fontFamily: 'var(--font-sans-body)',
      fontSize: 15,
      padding: '10px 14px',
      borderRadius: 'var(--radius-md)',
      border: '1px solid ' + (error ? 'var(--status-error)' : focus ? 'var(--border-focus)' : 'var(--border-default)'),
      background: disabled ? 'var(--surface-sunken)' : 'var(--surface-card)',
      color: 'var(--text-primary)',
      outline: 'none',
      boxShadow: focus ? '0 0 0 3px var(--green-100)' : 'none',
      transition: 'box-shadow var(--duration-fast) var(--ease-standard)'
    }
  }), (helper || error) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: error ? 'var(--status-error)' : 'var(--text-tertiary)'
    }
  }, error || helper));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
function Radio({
  label,
  checked,
  onChange,
  name,
  disabled
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      fontFamily: 'var(--font-sans-body)',
      fontSize: 14,
      color: 'var(--text-primary)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 18,
      height: 18,
      borderRadius: '50%',
      border: '1.5px solid ' + (checked ? 'var(--brand-primary)' : 'var(--border-strong)'),
      background: 'var(--surface-card)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, checked && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: '50%',
      background: 'var(--brand-primary)'
    }
  })), /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: name,
    checked: checked,
    onChange: onChange,
    disabled: disabled,
    style: {
      display: 'none'
    }
  }), label);
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  disabled
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans-body)',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--text-primary)'
    }
  }, label), /*#__PURE__*/React.createElement("select", {
    value: value,
    onChange: onChange,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      fontFamily: 'var(--font-sans-body)',
      fontSize: 15,
      padding: '10px 14px',
      borderRadius: 'var(--radius-md)',
      border: '1px solid ' + (focus ? 'var(--border-focus)' : 'var(--border-default)'),
      background: disabled ? 'var(--surface-sunken)' : 'var(--surface-card)',
      color: value ? 'var(--text-primary)' : 'var(--text-tertiary)',
      outline: 'none',
      appearance: 'none'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, placeholder), options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function Switch({
  label,
  checked,
  onChange,
  disabled
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      fontFamily: 'var(--font-sans-body)',
      fontSize: 14,
      color: 'var(--text-primary)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 38,
      height: 22,
      borderRadius: 'var(--radius-full)',
      background: checked ? 'var(--brand-primary)' : 'var(--border-default)',
      position: 'relative',
      transition: 'background var(--duration-fast) var(--ease-standard)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 2,
      left: checked ? 18 : 2,
      width: 18,
      height: 18,
      borderRadius: '50%',
      background: 'var(--surface-card)',
      boxShadow: 'var(--shadow-1)',
      transition: 'left var(--duration-fast) var(--ease-standard)'
    }
  })), /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: checked,
    onChange: onChange,
    disabled: disabled,
    style: {
      display: 'none'
    }
  }), label);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function Tabs({
  items,
  active,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      borderBottom: '1px solid var(--border-subtle)',
      fontFamily: 'var(--font-sans-body)'
    }
  }, items.map(it => {
    const isActive = it.value === active;
    return /*#__PURE__*/React.createElement("button", {
      key: it.value,
      onClick: () => onChange && onChange(it.value),
      style: {
        padding: '10px 16px',
        fontSize: 14,
        fontWeight: 600,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: isActive ? 'var(--brand-primary)' : 'var(--text-tertiary)',
        borderBottom: '2px solid ' + (isActive ? 'var(--brand-primary)' : 'transparent'),
        marginBottom: -1,
        transition: 'color var(--duration-fast)'
      }
    }, it.label, it.count != null && /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 6,
        fontSize: 12,
        color: 'var(--text-tertiary)'
      }
    }, it.count));
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-app/App.jsx
try { (() => {
function App() {
  const [loggedIn, setLoggedIn] = React.useState(false);
  const [screen, setScreen] = React.useState('dashboard');
  const [profile, setProfile] = React.useState(null);
  if (!loggedIn) return /*#__PURE__*/React.createElement(Login, {
    onLogin: () => setLoggedIn(true)
  });
  const openProfile = p => {
    setProfile(p);
    setScreen('profile');
  };
  return /*#__PURE__*/React.createElement(Shell, {
    active: screen === 'profile' ? 'discover' : screen,
    onNav: setScreen
  }, screen === 'dashboard' && /*#__PURE__*/React.createElement(Dashboard, {
    onNav: setScreen
  }), screen === 'discover' && /*#__PURE__*/React.createElement(Discover, {
    onOpenProfile: openProfile
  }), screen === 'profile' && /*#__PURE__*/React.createElement(ProfileDetail, {
    profile: profile,
    onSendInterest: () => setScreen('discover')
  }), screen === 'inbox' && /*#__PURE__*/React.createElement(InterestInbox, null), screen === 'chat' && /*#__PURE__*/React.createElement(Chat, null));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-app/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-app/Chat.jsx
try { (() => {
const MESSAGES = [{
  from: 'them',
  text: 'Assalamu alaikum, thank you for accepting. We would like to know more about the family background.'
}, {
  from: 'me',
  text: "Wa alaikum assalam. Of course — happy to share. Umme's father runs a small business in Dhaka."
}, {
  from: 'them',
  text: 'That sounds good. Would it be possible to arrange a call between the families next week?'
}];
function Chat() {
  const {
    Avatar,
    Button,
    IconButton
  } = window.SongiSathiDesignSystem_d7ffd3;
  const [flagged, setFlagged] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-sans-body)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 24px',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: 'var(--surface-card)'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    initials: "KU",
    tone: "primary"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 15,
      color: 'var(--text-primary)'
    }
  }, "Kamal Uddin"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--text-tertiary)'
    }
  }, "Guardian of PRN-09876 \xB7 Regarding PRN-10245")), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    style: {
      marginLeft: 'auto'
    }
  }, "Release contact")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      overflow: 'auto'
    }
  }, MESSAGES.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start',
      maxWidth: '65%',
      padding: '10px 14px',
      borderRadius: 'var(--radius-lg)',
      fontSize: 14,
      lineHeight: 1.5,
      background: m.from === 'me' ? 'var(--brand-primary)' : 'var(--surface-card-alt)',
      color: m.from === 'me' ? 'var(--text-on-brand)' : 'var(--text-primary)',
      border: m.from === 'me' ? 'none' : '1px solid var(--border-subtle)'
    }
  }, m.text)), flagged && /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: 'center',
      fontSize: 12,
      color: 'var(--status-error)',
      background: 'var(--status-error-bg)',
      padding: '8px 14px',
      borderRadius: 'var(--radius-md)'
    }
  }, "Message blocked \u2014 phone numbers can't be shared here. Use \"Release contact\" instead.")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      borderTop: '1px solid var(--border-subtle)',
      display: 'flex',
      gap: 10,
      background: 'var(--surface-card)'
    }
  }, /*#__PURE__*/React.createElement("input", {
    placeholder: "Type a message\u2026",
    style: {
      flex: 1,
      padding: '10px 14px',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-default)',
      fontFamily: 'var(--font-sans-body)',
      fontSize: 14,
      outline: 'none'
    },
    onChange: e => setFlagged(/\d{6,}/.test(e.target.value))
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "md"
  }, "Send")));
}
window.Chat = Chat;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-app/Chat.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-app/Dashboard.jsx
try { (() => {
function Dashboard({
  onNav
}) {
  const {
    Card,
    StatusPill,
    Button,
    Badge
  } = window.SongiSathiDesignSystem_d7ffd3;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 28,
      fontFamily: 'var(--font-sans-body)',
      maxWidth: 900
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-serif-display)',
      fontWeight: 600,
      fontSize: 26,
      color: 'var(--text-primary)',
      marginBottom: 4
    }
  }, "Welcome back, Rehana"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-tertiary)',
      marginBottom: 24
    }
  }, "Guardian \xB7 2 profiles managed"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, {
    interactive: true,
    onClick: () => onNav('discover'),
    style: {
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 16,
      color: 'var(--text-primary)'
    }
  }, "Umme Salma ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 400,
      color: 'var(--text-tertiary)'
    }
  }, "PRN-10245")), /*#__PURE__*/React.createElement(StatusPill, {
    status: "active"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-secondary)',
      marginTop: 8
    }
  }, "3 pending interests \xB7 1 unread message")), /*#__PURE__*/React.createElement(Card, {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 16,
      color: 'var(--text-primary)'
    }
  }, "Nadia Salma ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 400,
      color: 'var(--text-tertiary)'
    }
  }, "PRN-10611")), /*#__PURE__*/React.createElement(StatusPill, {
    status: "draft"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-secondary)'
    }
  }, "Pending moderation review"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 28,
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: () => onNav('discover')
  }, "Search for matches"), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: () => onNav('inbox')
  }, "Review interest inbox")));
}
window.Dashboard = Dashboard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-app/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-app/Discover.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const PROFILES = [{
  profileId: 'PRN-10245',
  name: 'Umme Salma',
  age: 27,
  height: "5'4\"",
  education: 'BSc Computer Science',
  district: 'Dhaka',
  managedBy: 'Guardian',
  verified: true
}, {
  profileId: 'PRN-10388',
  name: 'Farhan Ahmed',
  age: 30,
  height: "5'9\"",
  education: 'MBA, IBA',
  district: 'Chattogram',
  managedBy: 'Matchmaker'
}, {
  profileId: 'PRN-10502',
  name: 'Nusrat Jahan',
  age: 25,
  height: "5'3\"",
  education: 'MBBS',
  district: 'Sylhet',
  managedBy: 'Self-managed',
  verified: true
}, {
  profileId: 'PRN-10611',
  name: 'Tanvir Hasan',
  age: 29,
  height: "5'8\"",
  education: 'BSc Engineering',
  district: 'Dhaka',
  managedBy: 'Guardian'
}];
function Discover({
  onOpenProfile
}) {
  const {
    Input,
    Select,
    Button,
    ProfileCard,
    Tag
  } = window.SongiSathiDesignSystem_d7ffd3;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 28,
      fontFamily: 'var(--font-sans-body)',
      maxWidth: 900
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-serif-display)',
      fontWeight: 600,
      fontSize: 26,
      color: 'var(--text-primary)',
      marginBottom: 4
    }
  }, "Discover profiles"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-tertiary)',
      marginBottom: 20
    }
  }, "Browsing on behalf of PRN-10245 \xB7 Umme Salma"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      marginBottom: 14,
      flexWrap: 'wrap',
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement(Select, {
    label: "District",
    placeholder: "Any district",
    options: [{
      value: 'dhaka',
      label: 'Dhaka'
    }, {
      value: 'ctg',
      label: 'Chattogram'
    }]
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Education",
    placeholder: "Any level",
    options: [{
      value: 'bsc',
      label: 'Bachelor'
    }, {
      value: 'msc',
      label: 'Masters'
    }]
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Age range",
    placeholder: "Any age",
    options: [{
      value: '25-30',
      label: '25–30'
    }, {
      value: '30-35',
      label: '30–35'
    }]
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "md"
  }, "More filters")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    selected: true,
    onRemove: () => {}
  }, "28\u201332 yrs"), /*#__PURE__*/React.createElement(Tag, {
    selected: true,
    onRemove: () => {}
  }, "Dhaka")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, PROFILES.map(p => /*#__PURE__*/React.createElement(ProfileCard, _extends({
    key: p.profileId
  }, p, {
    photoLocked: true,
    onClick: () => onOpenProfile(p)
  })))));
}
window.Discover = Discover;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-app/Discover.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-app/InterestInbox.jsx
try { (() => {
const INTERESTS = [{
  id: 1,
  name: 'Farhan Ahmed',
  profileId: 'PRN-10388',
  for: 'Umme Salma (PRN-10245)',
  status: 'pending'
}, {
  id: 2,
  name: 'Tanvir Hasan',
  profileId: 'PRN-10611',
  for: 'Umme Salma (PRN-10245)',
  status: 'pending'
}, {
  id: 3,
  name: 'Kamal Uddin',
  profileId: 'PRN-09876',
  for: 'Umme Salma (PRN-10245)',
  status: 'accepted'
}];
function InterestInbox() {
  const {
    Card,
    Avatar,
    StatusPill,
    Button
  } = window.SongiSathiDesignSystem_d7ffd3;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 28,
      fontFamily: 'var(--font-sans-body)',
      maxWidth: 800
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-serif-display)',
      fontWeight: 600,
      fontSize: 26,
      color: 'var(--text-primary)',
      marginBottom: 20
    }
  }, "Interest inbox"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, INTERESTS.map(i => /*#__PURE__*/React.createElement(Card, {
    key: i.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    initials: i.name.split(' ').map(w => w[0]).join(''),
    tone: "secondary"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 15,
      color: 'var(--text-primary)'
    }
  }, i.name, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 400,
      color: 'var(--text-tertiary)',
      fontSize: 12
    }
  }, i.profileId)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-secondary)'
    }
  }, "Interested in ", i.for)), /*#__PURE__*/React.createElement(StatusPill, {
    status: i.status
  }), i.status === 'pending' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "destructive"
  }, "Decline"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "primary"
  }, "Accept")), i.status === 'accepted' && /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline"
  }, "Open chat")))));
}
window.InterestInbox = InterestInbox;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-app/InterestInbox.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-app/Login.jsx
try { (() => {
function Login({
  onLogin
}) {
  const [step, setStep] = React.useState('phone');
  const {
    Button,
    Input,
    Radio
  } = window.SongiSathiDesignSystem_d7ffd3;
  const [role, setRole] = React.useState('guardian');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--green-700)',
      fontFamily: 'var(--font-sans-body)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 380,
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-3)',
      padding: 32,
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-serif-display)',
      fontWeight: 600,
      fontSize: 28,
      color: 'var(--brand-primary)'
    }
  }, "SongiSathi"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-tertiary)',
      marginTop: 4
    }
  }, "A companion for the journey to marriage")), step === 'phone' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--text-primary)'
    }
  }, "I am creating an account as a"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Radio, {
    name: "role",
    label: "Matchmaker",
    checked: role === 'matchmaker',
    onChange: () => setRole('matchmaker')
  }), /*#__PURE__*/React.createElement(Radio, {
    name: "role",
    label: "Guardian",
    checked: role === 'guardian',
    onChange: () => setRole('guardian')
  }), /*#__PURE__*/React.createElement(Radio, {
    name: "role",
    label: "Self-managed",
    checked: role === 'self',
    onChange: () => setRole('self')
  })), /*#__PURE__*/React.createElement(Input, {
    label: "Phone number",
    caption: "\u09AB\u09CB\u09A8 \u09A8\u09AE\u09CD\u09AC\u09B0",
    placeholder: "+880 1XXX-XXXXXX"
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: () => setStep('otp')
  }, "Send OTP")), step === 'otp' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Input, {
    label: "Enter OTP",
    placeholder: "6-digit code",
    helper: "Sent via SMS to +880 1XXX-XXXXXX"
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: onLogin
  }, "Verify & continue"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => setStep('phone')
  }, "Change number"))));
}
window.Login = Login;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-app/Login.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-app/ProfileDetail.jsx
try { (() => {
function ProfileDetail({
  profile,
  onSendInterest
}) {
  const {
    Tabs,
    Button,
    Badge,
    Dialog
  } = window.SongiSathiDesignSystem_d7ffd3;
  const [tab, setTab] = React.useState('biodata');
  const [confirming, setConfirming] = React.useState(false);
  const p = profile || {
    profileId: 'PRN-10245',
    name: 'Umme Salma',
    age: 27,
    district: 'Dhaka'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 28,
      fontFamily: 'var(--font-sans-body)',
      maxWidth: 800
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 140,
      height: 176,
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(135deg,var(--terracotta-200),var(--green-200))',
      filter: 'blur(7px)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--photo-lock-scrim)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      color: 'var(--ivory-050)',
      textAlign: 'center',
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "4",
    y: "11",
    width: "16",
    height: "9",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 11V7a4 4 0 0 1 8 0v4"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600
    }
  }, "Request photo access"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-serif-display)',
      fontWeight: 600,
      fontSize: 28,
      color: 'var(--text-primary)'
    }
  }, p.name, ", ", p.age), p.verified && /*#__PURE__*/React.createElement(Badge, {
    tone: "gold"
  }, "Verified")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--text-secondary)',
      marginTop: 4
    }
  }, p.profileId, " \xB7 Managed by ", p.managedBy), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--text-secondary)'
    }
  }, p.district, ", Bangladesh"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: onSendInterest
  }, "Send interest"), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: () => setConfirming(true)
  }, "Request contact release")))), /*#__PURE__*/React.createElement(Tabs, {
    items: [{
      value: 'biodata',
      label: 'Biodata'
    }, {
      value: 'family',
      label: 'Family'
    }, {
      value: 'expectations',
      label: 'Partner expectations'
    }],
    active: tab,
    onChange: setTab
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, tab === 'biodata' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Field, {
    label: "Height",
    value: "5'4\""
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Complexion",
    value: "Fair"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Blood group",
    value: "B+"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Education",
    value: "BSc Computer Science, BUET"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Occupation",
    value: "Software Engineer, income range 80\u2013120k BDT"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Religious practice",
    value: "Regular prayer, follows Hanafi madhhab"
  })), tab === 'family' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Field, {
    label: "Father's occupation",
    value: "Businessman"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Mother's occupation",
    value: "Homemaker"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Siblings",
    value: "One elder brother (married)"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Family type",
    value: "Nuclear"
  })), tab === 'expectations' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Field, {
    label: "Age range",
    value: "28\u201334"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Education",
    value: "Bachelor's or above"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Location",
    value: "Dhaka or willing to relocate"
  }))), /*#__PURE__*/React.createElement(Dialog, {
    open: confirming,
    title: "Request contact release?",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      onClick: () => setConfirming(false)
    }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: () => setConfirming(false)
    }, "Send request"))
  }, "The other manager will be asked to share this profile's phone number with you. This is only available after a connection is accepted."));
}
window.ProfileDetail = ProfileDetail;
function Field({
  label,
  value
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--text-tertiary)',
      fontWeight: 700
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: 'var(--text-primary)',
      marginTop: 2
    }
  }, value));
}
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-app/ProfileDetail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-app/Shell.jsx
try { (() => {
function Shell({
  active,
  onNav,
  children
}) {
  const nav = [{
    key: 'dashboard',
    label: 'Dashboard'
  }, {
    key: 'discover',
    label: 'Discover'
  }, {
    key: 'inbox',
    label: 'Interest inbox',
    count: 3
  }, {
    key: 'chat',
    label: 'Conversations'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: '100%',
      fontFamily: 'var(--font-sans-body)',
      background: 'var(--surface-page)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 220,
      flexShrink: 0,
      background: 'var(--surface-inverse)',
      color: 'var(--ivory-050)',
      display: 'flex',
      flexDirection: 'column',
      padding: '22px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-serif-display)',
      fontWeight: 600,
      fontSize: 22,
      marginBottom: 28
    }
  }, "SongiSathi"), nav.map(n => /*#__PURE__*/React.createElement("div", {
    key: n.key,
    onClick: () => onNav(n.key),
    style: {
      padding: '10px 12px',
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer',
      marginBottom: 4,
      background: active === n.key ? 'rgba(255,255,255,0.12)' : 'transparent',
      fontWeight: 600,
      fontSize: 14,
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", null, n.label), n.count != null && /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.7,
      fontWeight: 400
    }
  }, n.count))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      fontSize: 12,
      opacity: 0.65,
      lineHeight: 1.5
    }
  }, "Managing profiles as", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("strong", null, "Guardian"), " \xB7 Rehana S.")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto'
    }
  }, children));
}
window.Shell = Shell;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-app/Shell.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.ProfileCard = __ds_scope.ProfileCard;

__ds_ns.StatusPill = __ds_scope.StatusPill;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
