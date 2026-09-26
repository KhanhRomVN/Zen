import { DropdownContentProps } from './type';

export function DropdownContent({ children, className }: DropdownContentProps) {
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}
      className={className}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '4px 0' }}>{children}</div>
    </div>
  );
}

DropdownContent.displayName = 'DropdownContent';

export default DropdownContent;