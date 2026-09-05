// File này có một số exports được dùng, một số không

export function usedFunction() {
  return 'This is used';
}

export function unusedFunction() {
  return 'This is NOT used';
}

export const USED_CONSTANT = 'used';
export const UNUSED_CONSTANT = 'not used';

export interface UsedInterface {
  id: number;
  name: string;
}

export interface UnusedInterface {
  foo: string;
  bar: number;
}

export type UsedType = string | number;
export type UnusedType = boolean | null;
