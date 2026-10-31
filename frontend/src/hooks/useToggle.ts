"use client";

import { useCallback, useState } from "react";

export function useToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue);

  const toggle = useCallback(() => setValue((currentValue) => !currentValue), []);
  const open = useCallback(() => setValue(true), []);
  const close = useCallback(() => setValue(false), []);

  return {
    value,
    toggle,
    open,
    close,
    setValue,
  };
}
