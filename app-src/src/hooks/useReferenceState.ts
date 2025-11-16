/**
 * useReferenceState Hook
 * Manages collapsed/expanded state for reference containers in message content
 * Persists state across re-renders using a global Map
 */

// Global state map to persist collapsed state across re-renders
// Key: message ID, Value: Map of container index -> expanded state
const globalCollapsedState = new Map<string, Map<number, boolean>>();

interface UseReferenceStateReturn {
  getStateKey: (messageId?: string, content: string) => string;
  restoreCollapsedState: (containers: NodeListOf<Element> | Element[], stateKey: string) => void;
  collapseAllReferences: (containers: NodeListOf<Element>, stateKey: string) => void;
  ensureCollapsedDuringStreaming: (containers: NodeListOf<Element>) => void;
  saveCollapsedState: (containers: NodeListOf<Element>, stateKey: string) => void;
}

/**
 * Hook for managing reference container collapsed state
 */
export function useReferenceState(): UseReferenceStateReturn {
  /**
   * Get state key - use messageId if available, otherwise fall back to content hash
   */
  const getStateKey = (messageId?: string, content: string = ''): string => {
    if (messageId) {
      return messageId;
    }
    // Fallback to content hash if no messageId provided
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  };

  /**
   * Helper to restore collapsed state
   */
  const restoreCollapsedState = (containers: NodeListOf<Element> | Element[], stateKey: string): void => {
    const stateMap = globalCollapsedState.get(stateKey);
    
    if (!stateMap) {
      return;
    }
    
    Array.from(containers).forEach((container, index) => {
      const savedState = stateMap.get(index);
      
      if (savedState !== undefined) {
        const contentWrapper = container.querySelector('.references-content');
        const toggle = container.querySelector('.references-toggle');
        const plusIcon = toggle?.querySelector('.plus') as HTMLElement;
        const minusIcon = toggle?.querySelector('.minus') as HTMLElement;
        
        if (contentWrapper && toggle) {
          if (savedState) {
            // Was expanded - restore expanded state
            contentWrapper.classList.remove('collapsed');
            contentWrapper.classList.add('expanded');
            toggle.setAttribute('aria-expanded', 'true');
            if (plusIcon) plusIcon.style.display = 'none';
            if (minusIcon) minusIcon.style.display = '';
          } else {
            // Was collapsed - ensure collapsed state
            contentWrapper.classList.remove('expanded');
            contentWrapper.classList.add('collapsed');
            toggle.setAttribute('aria-expanded', 'false');
            if (plusIcon) plusIcon.style.display = '';
            if (minusIcon) minusIcon.style.display = 'none';
          }
        }
      }
    });
  };

  /**
   * Lightweight helper to ensure references containers stay collapsed during streaming
   * Only does minimal DOM manipulation - just ensures existing containers are collapsed
   */
  const ensureCollapsedDuringStreaming = (containers: NodeListOf<Element>): void => {
    if (containers.length === 0) return; // No containers yet, nothing to do
    
    // For each existing container, ensure it's collapsed
    containers.forEach((container) => {
      const contentWrapper = container.querySelector('.references-content');
      const toggle = container.querySelector('.references-toggle');
      const plusIcon = toggle?.querySelector('.plus') as HTMLElement;
      const minusIcon = toggle?.querySelector('.minus') as HTMLElement;
      
      if (contentWrapper && toggle) {
        // Ensure collapsed state (lightweight - just class manipulation)
        contentWrapper.classList.remove('expanded');
        contentWrapper.classList.add('collapsed');
        toggle.setAttribute('aria-expanded', 'false');
        if (plusIcon) plusIcon.style.display = '';
        if (minusIcon) minusIcon.style.display = 'none';
      }
    });
  };

  /**
   * Save state immediately whenever the DOM might change
   */
  const saveCollapsedState = (containers: NodeListOf<Element>, stateKey: string): void => {
    if (containers.length === 0) return;
    
    let stateMap = globalCollapsedState.get(stateKey);
    if (!stateMap) {
      stateMap = new Map();
      globalCollapsedState.set(stateKey, stateMap);
    }
    
    containers.forEach((container, index) => {
      const contentWrapper = container.querySelector('.references-content');
      const toggle = container.querySelector('.references-toggle');
      if (contentWrapper && toggle) {
        const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        stateMap.set(index, isExpanded);
      }
    });
  };

  /**
   * Helper function to collapse all references containers
   */
  const collapseAllReferences = (containers: NodeListOf<Element>, stateKey: string): void => {
    if (containers.length === 0) return;
    
    let stateMap = globalCollapsedState.get(stateKey);
    if (!stateMap) {
      stateMap = new Map();
      globalCollapsedState.set(stateKey, stateMap);
    }
    
    containers.forEach((container, index) => {
      const contentWrapper = container.querySelector('.references-content');
      const toggle = container.querySelector('.references-toggle');
      const plusIcon = toggle?.querySelector('.plus') as HTMLElement;
      const minusIcon = toggle?.querySelector('.minus') as HTMLElement;
      
      if (contentWrapper && toggle) {
        // Collapse the container
        contentWrapper.classList.remove('expanded');
        contentWrapper.classList.add('collapsed');
        toggle.setAttribute('aria-expanded', 'false');
        if (plusIcon) plusIcon.style.display = '';
        if (minusIcon) minusIcon.style.display = 'none';
        
        // Update global state to reflect collapsed state
        stateMap.set(index, false);
      }
    });
  };

  return {
    getStateKey,
    restoreCollapsedState,
    collapseAllReferences,
    ensureCollapsedDuringStreaming,
    saveCollapsedState,
  };
}

