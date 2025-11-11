/**
 * Tooltip - A reusable tooltip component with better styling
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export function Tooltip({ 
  content, 
  children, 
  position = 'top',
  delay = 0,
  className = ''
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (delay > 0) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
        updatePosition();
      }, delay);
    } else {
      setIsVisible(true);
      updatePosition();
    }
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  const updatePosition = () => {
    if (!wrapperRef.current || !tooltipRef.current) return;

    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = wrapperRect.top - tooltipRect.height - 8;
        left = wrapperRect.left + (wrapperRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        top = wrapperRect.bottom + 8;
        left = wrapperRect.left + (wrapperRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = wrapperRect.top + (wrapperRect.height / 2) - (tooltipRect.height / 2);
        left = wrapperRect.left - tooltipRect.width - 8;
        break;
      case 'right':
        top = wrapperRect.top + (wrapperRect.height / 2) - (tooltipRect.height / 2);
        left = wrapperRect.right + 8;
        break;
    }

    // Keep tooltip within viewport
    const padding = 8;
    if (left < padding) left = padding;
    if (left + tooltipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - tooltipRect.width - padding;
    }
    if (top < padding) top = padding;
    if (top + tooltipRect.height > window.innerHeight - padding) {
      top = window.innerHeight - tooltipRect.height - padding;
    }

    setTooltipPosition({ top, left });
  };

  useEffect(() => {
    if (isVisible) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isVisible]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const childWithProps = React.cloneElement(children, {
    onMouseEnter: showTooltip,
    onMouseLeave: hideTooltip,
    onFocus: showTooltip,
    onBlur: hideTooltip,
  });

  const tooltipContent = isVisible ? (
    <div
      ref={tooltipRef}
      className={`tooltip ${className}`}
      style={{
        position: 'fixed',
        top: `${tooltipPosition.top}px`,
        left: `${tooltipPosition.left}px`,
        zIndex: 1000,
      }}
      role="tooltip"
    >
      {content}
      <div className={`tooltip-arrow tooltip-arrow-${position}`} />
    </div>
  ) : null;

  return (
    <>
      <div ref={wrapperRef} style={{ display: 'inline-block' }}>
        {childWithProps}
      </div>
      {tooltipContent && createPortal(tooltipContent, document.body)}
    </>
  );
}

