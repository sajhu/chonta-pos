const AUTO_PRINT_KEY = "chonta_pos_auto_print";

export function getAutoPrint(): boolean {
  const value = localStorage.getItem(AUTO_PRINT_KEY);
  return value === null ? true : value === "true";
}

export function setAutoPrint(value: boolean): void {
  localStorage.setItem(AUTO_PRINT_KEY, String(value));
}
