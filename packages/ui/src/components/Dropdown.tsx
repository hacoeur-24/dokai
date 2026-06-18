import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Check } from 'lucide-react';
import { type ReactNode } from 'react';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface DropdownProps<T extends string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  /** Optional label shown before the selected text in the trigger. */
  placeholder?: string;
  disabled?: boolean;
  /** Additional class names applied to the trigger button. */
  className?: string;
  /** Span the container width (use when replacing a full-width <select>). */
  fullWidth?: boolean;
}

/**
 * Generic dropdown selector built on @radix-ui/react-dropdown-menu.
 * The trigger renders as a `.dokai-control` button so it matches native form controls.
 */
export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  className,
  fullWidth = false,
}: DropdownProps<T>) {
  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? placeholder ?? value;
  const icon = selected?.icon;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={['dokai-control', 'dokai-select-trigger', className].filter(Boolean).join(' ')}
          style={fullWidth ? { width: '100%' } : undefined}
        >
          {icon != null && <span className="dokai-select-trigger__icon">{icon}</span>}
          <span className="dokai-select-trigger__label">{label}</span>
          <ChevronDown className="dokai-select-trigger__chevron h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="dokai-dropdown-menu"
          align="start"
          sideOffset={4}
          style={{ minWidth: 'var(--radix-dropdown-menu-trigger-width)' }}
        >
          {options.map((option) => (
            <DropdownMenu.Item
              key={option.value}
              className="dokai-dropdown-item"
              onSelect={() => onChange(option.value)}
              aria-current={option.value === value ? 'true' : undefined}
            >
              {option.icon != null && <span aria-hidden="true">{option.icon}</span>}
              <span className="flex-1">{option.label}</span>
              {option.value === value && (
                <Check className="h-3.5 w-3.5" aria-hidden="true" style={{ color: 'var(--color-accent)' }} />
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
