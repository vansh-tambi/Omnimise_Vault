export const Card = ({ children, style = {}, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
      transition: 'border-color 0.15s, background 0.15s',
      cursor: onClick ? 'pointer' : 'default',
      ...style,
    }}
    onMouseEnter={(e) => {
      if (onClick) {
        e.currentTarget.style.borderColor = 'var(--border-strong)';
        e.currentTarget.style.background = 'var(--bg-elevated)';
      }
    }}
    onMouseLeave={(e) => {
      if (onClick) {
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
        e.currentTarget.style.background = 'var(--bg-surface)';
      }
    }}
  >
    {children}
  </div>
);

export const Button = ({ children, variant = 'default', onClick, disabled, style = {}, size = 'md', type = 'button' }) => {
  const variants = {
    default: { background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' },
    primary: { background: 'var(--accent)', color: '#0a0a0a', border: '1px solid var(--accent)', fontWeight: '600' },
    danger: { background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(255,68,68,0.2)' },
    ghost: { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid transparent' },
    success: { background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(68,255,136,0.2)' },
  };
  const sizes = {
    sm: { padding: '5px 10px', fontSize: '12px', borderRadius: 'var(--radius-sm)' },
    md: { padding: '8px 16px', fontSize: '13px', borderRadius: 'var(--radius-md)' },
    lg: { padding: '11px 22px', fontSize: '14px', borderRadius: 'var(--radius-md)' },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...variants[variant],
        ...sizes[size],
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        fontFamily: 'var(--font-sans)',
        transition: 'opacity 0.15s, background 0.15s',
        outline: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  );
};

export const Badge = ({ children, variant = 'default' }) => {
  const variants = {
    default: { background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' },
    accent: { background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(232,255,71,0.2)' },
    red: { background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(255,68,68,0.15)' },
    green: { background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(68,255,136,0.15)' },
    amber: { background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(255,170,68,0.15)' },
    blue: { background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(68,136,255,0.15)' },
  };
  return (
    <span
      style={{
        ...variants[variant],
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        fontWeight: '500',
        letterSpacing: '0.03em',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      {children}
    </span>
  );
};

export const Input = ({ placeholder, value, onChange, type = 'text', style = {}, ...props }) => (
  <input
    type={type}
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    style={{
      width: '100%',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      padding: '9px 12px',
      fontSize: '13px',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
      outline: 'none',
      transition: 'border-color 0.15s',
      ...style,
    }}
    onFocus={(e) => {
      e.target.style.borderColor = 'var(--border-strong)';
    }}
    onBlur={(e) => {
      e.target.style.borderColor = 'var(--border-default)';
    }}
    {...props}
  />
);

export const Divider = () => (
  <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '16px 0' }} />
);

export const Label = ({ children }) => (
  <p
    style={{
      fontSize: '11px',
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-tertiary)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: '8px',
    }}
  >
    {children}
  </p>
);

export const PageHeader = ({ title, subtitle, actions }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: '28px',
      paddingBottom: '20px',
      borderBottom: '1px solid var(--border-subtle)',
    }}
  >
    <div>
      <h1 style={{ fontSize: '18px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '4px' }}>{title}</h1>
      {subtitle && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{subtitle}</p>}
    </div>
    {actions && <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>{actions}</div>}
  </div>
);

export const EmptyState = ({ icon, title, description, action }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 24px',
      textAlign: 'center',
      color: 'var(--text-tertiary)',
    }}
  >
    <div style={{ fontSize: '28px', marginBottom: '16px', opacity: 0.5 }}>{icon}</div>
    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '500' }}>{title}</p>
    <p style={{ fontSize: '13px', marginBottom: '20px', maxWidth: '280px', lineHeight: '1.6' }}>{description}</p>
    {action}
  </div>
);
