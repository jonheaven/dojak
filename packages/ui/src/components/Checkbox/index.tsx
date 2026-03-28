import React from 'react';

export interface CheckboxChangeEvent {
  target: {
    checked: boolean;
  };
}

export interface CheckboxProps {
  checked?: boolean;
  onChange?: (e: CheckboxChangeEvent) => void;
  style?: React.CSSProperties;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function Checkbox(props: CheckboxProps) {
  const { checked = false, onChange, style, disabled = false, children, className } = props;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;

    onChange?.({
      target: {
        checked: e.target.checked
      }
    });
  };

  return (
    <label
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        ...style
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '18px',
          height: '18px',
          marginRight: '10px'
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          style={{
            appearance: 'none',
            width: '18px',
            height: '18px',
            backgroundColor: checked ? '#C9822A' : 'rgba(30, 30, 30, 0.8)',
            border: checked ? '2px solid #C9822A' : '2px solid rgba(255, 255, 255, 0.5)',
            borderRadius: '4px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            position: 'absolute',
            top: 0,
            left: 0,
            transition: 'all 0.2s ease'
          }}
        />
        {checked && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '10px',
              height: '6px',
              border: '2px solid #1a1a1a',
              borderTop: 'none',
              borderRight: 'none',
              transform: 'translate(-50%, -70%) rotate(-45deg)',
              pointerEvents: 'none'
            }}
          />
        )}
      </div>
      {children}
    </label>
  );
}
