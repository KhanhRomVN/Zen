/**
 * ReadMemoryParser — parse <read_memory /> tag.
 * Tag này không có tham số, chỉ cần phát hiện sự tồn tại là đủ.
 */

export interface ReadMemoryParams {
  _empty?: true;
}

export const parseReadMemory = (_innerContent: string): ReadMemoryParams => {
  // read_memory không nhận tham số nào.
  return {};
};