import { useEffect } from 'react';

declare global {
  var frameworkReady: (() => void) | undefined;
}

export function useFrameworkReady() {
  useEffect(() => {
    global.frameworkReady?.();
  }, []); // Empty dependency array - runs only once
}