import { DropdownContentProps } from './type';

export function DropdownContent({ children, className, size, hideScrollbar }: DropdownContentProps) {
  const maxHeight = size === 'lg' ? '500px' : size === 'sm' ? '200px' : '400px';
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}
      className={className}
      onClick={(e) => e.stopPropagation()}
    >
      {hideScrollbar && (
        <style>{`.zen-hide-scrollbar{scrollbar-width:none;-ms-overflow-style:none;}.zen-hide-scrollbar::-webkit-scrollbar{display:none;}`}</style>
      )}
      <div
        className={hideScrollbar ? 'zen-hide-scrollbar' : undefined}
        style={{ maxHeight, overflowY: 'auto', padding: '4px 0' }}
      >
        {children}
      </div>
    </div>
  );
}

DropdownContent.displayName = 'DropdownContent';

export default DropdownContent;