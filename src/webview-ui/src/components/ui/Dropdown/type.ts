import React from 'react';

export interface DropdownProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom' | 'left' | 'right';
  sideOffset?: number;
  disableAutoFlip?: boolean;
  strategy?: 'fixed' | 'relative';
  className?: string;
  trigger?: 'click' | 'contextmenu';
  /** Manual position override for fixed strategy (e.g., for context menus at cursor position) */
  position?: { top: number; left: number };
  searchable?: boolean;
  closeOnSelect?: boolean;
}

export interface DropdownTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export interface DropdownContentProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export interface DropdownItemProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  closeOnSelect?: boolean;
  variant?: 'default' | 'error';
  noPadding?: boolean;
  items?: DropdownItemProps[]; // Nested submenu items
}

export interface DropdownSeparatorProps {
  className?: string;
}