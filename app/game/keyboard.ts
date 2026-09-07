export function isEditableTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='listbox'], [role='combobox']"));
}

export function shouldIgnoreGameKey(event: KeyboardEvent) {
  return event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey
    || isEditableTarget(event.target);
}
