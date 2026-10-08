import { DropdownContentProps } from './type';

export function DropdownContent({ children, className, size }: DropdownContentProps) {
  const maxHeight = size === 'lg' ? '500px' : size === 'sm' ? '200px' : '400px';
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}
      className={className}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ maxHeight, overflowY: 'auto', padding: '4px 0' }}>{children}</div>
    </div>
  );
}

DropdownContent.displayName = 'DropdownContent';

export default DropdownContent;