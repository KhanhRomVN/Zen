sửa lỗi gặp lỗi Browser closed unexpectedly thì server bị tắt đột ngột

[ERROR] [src/services/login.service.ts:381] [LoginService] Browser closed unexpectedly for qwen
/home/khanhromvn/Documents/Coding/AIWeb2API & Zen/AIWeb2API/src/services/login.service.ts:388
        const error = new Error('Browser closed unexpectedly');
                      ^

Error: Browser closed unexpectedly
    at CDPService.<anonymous> (/home/khanhromvn/Documents/Coding/AIWeb2API & Zen/AIWeb2API/src/services/login.service.ts:388:23)
    at CDPService.emit (node:events:519:28)
    at ChildProcess.<anonymous> (/home/khanhromvn/Documents/Coding/AIWeb2API & Zen/AIWeb2API/src/services/cdp.service.ts:207:12)
    at ChildProcess.emit (node:events:519:28)
    at ChildProcess._handle.onexit (node:internal/child_process:293:12)
    at Process.callbackTrampoline (node:internal/async_hooks:130:17) {
  code: 'BROWSER_CLOSED'
}