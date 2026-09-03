import { useState, useRef, useEffect, createContext, useContext } from "react";
import React from "react";
import { createPortal } from "react-dom";
import { DropdownProps } from "./type";
type Position = { top: number; left: number; width?: number };

interface DropdownContextType {
  close: () => void;
  searchText?: string;
  hasSearchbar?: boolean;
  closeOnSelect: boolean;
}

const DropdownContext = createContext<DropdownContextType | null>(null);

export function useDropdownContext() {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error("DropdownItem must be used within Dropdown");
  }
  return context;
}

export function Dropdown({
  children,
  open: controlledOpen,
  onOpenChange,
  align = "center",
  side = "bottom",
  sideOffset = 8,
  disableAutoFlip = false,
  strategy = "fixed",
  className,
  trigger = "click",
  position: manualPosition,
  searchable = false,
  closeOnSelect = true,
}: DropdownProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(value);
    onOpenChange?.(value);
    // Reset search when closing
    if (!value) setSearchText("");
  };
  const close = () => setOpen(false);

  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position>({
    top: 0,
    left: 0,
    width: undefined,
  });
  const [isPositioned, setIsPositioned] = useState(false);

  // Calculate position for fixed strategy
  const calculateFixedPosition = (): Position | null => {
    if (!triggerRef.current || !contentRef.current) return null;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const contentRect = contentRef.current.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    let top = 0;
    let left = 0;
    const offset = sideOffset;

    // Calculate base position based on side
    switch (side) {
      case "bottom":
        top = triggerRect.bottom + offset;
        left = triggerRect.left;
        break;
      case "top":
        top = triggerRect.top - contentRect.height - offset;
        left = triggerRect.left;
        break;
      case "left":
        top = triggerRect.top;
        left = triggerRect.left - contentRect.width - offset;
        break;
      case "right":
        top = triggerRect.top;
        left = triggerRect.right + offset;
        break;
    }

    // Adjust for alignment
    switch (side) {
      case "bottom":
      case "top":
        if (align === "center") {
          left += (triggerRect.width - contentRect.width) / 2;
        } else if (align === "end") {
          // Right-align: dropdown's right edge aligns with trigger's right edge
          left = triggerRect.right - contentRect.width;
        }
        break;
      case "left":
      case "right":
        if (align === "center") {
          top += (triggerRect.height - contentRect.height) / 2;
        } else if (align === "end") {
          // Bottom-align: dropdown's bottom edge aligns with trigger's bottom edge
          top = triggerRect.bottom - contentRect.height;
        }
        break;
    }

    // Auto-flip if needed
    const margin = 8;
    let finalTop = top;
    let finalLeft = left;

    if (!disableAutoFlip) {
      if (side === "bottom" && top + contentRect.height > viewport.height) {
        finalTop = triggerRect.top - contentRect.height - offset;
      } else if (side === "top" && top < 0) {
        finalTop = triggerRect.bottom + offset;
      } else if (
        side === "top" &&
        triggerRect.bottom + offset + contentRect.height > viewport.height
      ) {
        const spaceAbove = triggerRect.top - margin;
        const spaceBelow = viewport.height - triggerRect.bottom - margin;

        if (
          spaceBelow > spaceAbove &&
          spaceBelow >= contentRect.height + offset
        ) {
          finalTop = triggerRect.bottom + offset;
        }
      }

      if (side === "right" && left + contentRect.width > viewport.width) {
        finalLeft = triggerRect.left - contentRect.width - offset;
      } else if (side === "left" && left < 0) {
        finalLeft = triggerRect.right + offset;
      }
    }

    // Clamp to viewport (but respect alignment when possible)
    if (finalTop < margin) finalTop = margin;
    if (finalTop + contentRect.height > viewport.height - margin) {
      finalTop = viewport.height - contentRect.height - margin;
    }

    // For align="end", prioritize right-alignment over viewport clamping
    if (align === "end" && (side === "bottom" || side === "top")) {
      // Only prevent going off the LEFT edge, allow right overflow
      if (finalLeft < margin) finalLeft = margin;
    } else {
      // Default clamping for other alignments
      if (finalLeft < margin) finalLeft = margin;
      if (finalLeft + contentRect.width > viewport.width - margin) {
        finalLeft = viewport.width - contentRect.width - margin;
      }
    }

    return { top: finalTop, left: finalLeft, width: triggerRect.width };
  };

  const updatePosition = () => {
    if (strategy === "fixed") {
      // Use manual position if provided (e.g., for context menus)
      if (manualPosition) {
        setPosition(manualPosition);
        setIsPositioned(true);
        return;
      }
      const pos = calculateFixedPosition();
      if (pos) {
        setPosition(pos);
        setIsPositioned(true);
      }
    } else {
      // Relative strategy doesn't need position calculation
      setIsPositioned(true);
    }
  };
  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
    return undefined;
  }, [open]);

  // Update position when open or props change
  useEffect(() => {
    if (open && contentRef.current) {
      // Double requestAnimationFrame to ensure content has rendered with correct dimensions
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          updatePosition();
        });
      });
    } else {
      setIsPositioned(false);
    }
  }, [open, side, align, sideOffset, strategy, manualPosition]);

  // Watch for content size changes and recalculate position
  useEffect(() => {
    if (!open || !contentRef.current || strategy !== "fixed") return;

    const resizeObserver = new ResizeObserver(() => {
      updatePosition();
    });

    resizeObserver.observe(contentRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [open, strategy]);

  // Handle resize and scroll for fixed strategy
  useEffect(() => {
    if (!open || strategy !== "fixed") return;

    let rafId: number | null = null;

    const handleUpdate = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      rafId = requestAnimationFrame(updatePosition);
    };

    const getScrollableParents = (
      element: HTMLElement | null,
    ): HTMLElement[] => {
      const parents: HTMLElement[] = [];
      let current = element?.parentElement;

      while (current) {
        const { overflow, overflowY, overflowX } =
          window.getComputedStyle(current);
        if (
          overflow === "auto" ||
          overflow === "scroll" ||
          overflowY === "auto" ||
          overflowY === "scroll" ||
          overflowX === "auto" ||
          overflowX === "scroll"
        ) {
          parents.push(current);
        }
        current = current.parentElement;
      }

      return parents;
    };

    const scrollableParents = getScrollableParents(triggerRef.current);

    window.addEventListener("resize", handleUpdate);
    window.addEventListener("scroll", handleUpdate, true);

    scrollableParents.forEach((parent) => {
      parent.addEventListener("scroll", handleUpdate);
    });

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("scroll", handleUpdate, true);
      scrollableParents.forEach((parent) => {
        parent.removeEventListener("scroll", handleUpdate);
      });
    };
  }, [open, strategy]);

  const childrenArray = React.Children.toArray(children);
  const triggerChild = childrenArray.find(
    (child) =>
      React.isValidElement(child) &&
      (child.type as any)?.displayName === "DropdownTrigger",
  );
  const content = childrenArray.find(
    (child) =>
      React.isValidElement(child) &&
      (child.type as any)?.displayName === "DropdownContent",
  );

  // Get CSS classes for relative positioning
  const getRelativePositionClasses = () => {
    const classes = ["absolute", "z-[9999]"];

    switch (side) {
      case "top":
        classes.push("bottom-full", `mb-[${sideOffset}px]`);
        break;
      case "bottom":
        classes.push("top-full", `mt-[${sideOffset}px]`);
        break;
      case "left":
        classes.push("right-full", `mr-[${sideOffset}px]`);
        break;
      case "right":
        classes.push("left-full", `ml-[${sideOffset}px]`);
        break;
    }

    // Alignment for top/bottom
    if (side === "top" || side === "bottom") {
      if (align === "start") {
        classes.push("left-0");
      } else if (align === "center") {
        classes.push("left-1/2", "-translate-x-1/2");
      } else if (align === "end") {
        classes.push("right-0");
      }
    }

    // Alignment for left/right
    if (side === "left" || side === "right") {
      if (align === "start") {
        classes.push("top-0");
      } else if (align === "center") {
        classes.push("top-1/2", "-translate-y-1/2");
      } else if (align === "end") {
        classes.push("bottom-0");
      }
    }

    return classes.join(" ");
  };

  return (
    <DropdownContext.Provider
      value={{ close, searchText, hasSearchbar: searchable, closeOnSelect }}
    >
      <div className={`relative inline-block ${className ?? ""}`.trim()}>
        <div
          ref={triggerRef}
          onClick={trigger === "click" ? () => setOpen(!open) : undefined}
          onContextMenu={
            trigger === "contextmenu"
              ? (e) => {
                  e.preventDefault();
                  setOpen(!open);
                }
              : undefined
          }
        >
          {triggerChild}
        </div>
        {open && content && (
          <>
            {strategy === "fixed" ? (
              createPortal(
                <div
                  ref={contentRef}
                  style={{
                    position: "fixed",
                    zIndex: 9999,
                    top: position.top,
                    left: position.left,
                    opacity: 1,
                    transition: "opacity 0.15s ease",
                    pointerEvents: "auto",
                    backgroundColor: "var(--tertiary-bg)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "10px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                    minWidth: "200px",
                    overflow: "hidden",
                  }}
                >
                  {searchable && (
                    <div className="p-2 border-b border-border bg-background">
                      <input
                        type="text"
                        placeholder="Search actions..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm bg-input-background border border-border rounded-lg outline-none text-text-primary placeholder:text-text-tertiary"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                  {content}
                </div>,
                document.body,
              )
            ) : (
              <div
                ref={contentRef}
                style={{
                  opacity: 1,
                  transition: "opacity 0.15s ease",
                  pointerEvents: "auto",
                  backgroundColor: "var(--tertiary-bg)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "10px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                  minWidth: "200px",
                  overflow: "hidden",
                }}
              >
                {searchable && (
                  <div className="p-2 border-b border-border bg-background">
                    <input
                      type="text"
                      placeholder="Search actions..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm bg-input-background border border-border rounded-lg outline-none text-text-primary placeholder:text-text-tertiary"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
                {content}
              </div>
            )}
          </>
        )}
      </div>
    </DropdownContext.Provider>
  );
}

Dropdown.displayName = "Dropdown";

export default Dropdown;
