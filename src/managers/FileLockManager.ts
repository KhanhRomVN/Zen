/**
 *? Usage:
 *    Quản lý khóa file tuần tự (mutex queue) — đảm bảo các thao tác ghi trên cùng một file không chạy đồng thời.
 *
 *? Function:
 *    acquire(): Chờ đến lượt, khóa file, trả về hàm release để mở khóa.
 */
export class FileLockManager {
  private locks = new Map<string, Promise<void>>();

  async acquire(key: string): Promise<() => void> {
    let release: () => void;

    // Create the task that the NEXT requestor will wait for
    const task = new Promise<void>((resolve) => {
      release = resolve;
    });

    // Get the current tail of the queue
    const prev = this.locks.get(key) || Promise.resolve();

    // Update the tail. We catch errors on 'prev' so strict serialization continues even if a previous task failed.
    const nextFn = () => task;
    this.locks.set(key, prev.then(nextFn, nextFn));

    // Wait for the previous task to complete
    await prev.catch(() => {});

    return release!;
  }
}
