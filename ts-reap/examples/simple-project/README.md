# TS Reap Example Project

Đây là project example để test ts-reap.

## Expected Results

Khi chạy `ts-reap check`, sẽ phát hiện các unused exports trong `src/utils.ts`:

- ❌ `unusedFunction`
- ❌ `UNUSED_CONSTANT`
- ❌ `UnusedInterface`
- ❌ `UnusedType`

File `src/index.ts` là entry point nên exports của nó được phép unused.

## Run Analysis

```bash
# Install dependencies
npm install

# Run ts-reap check
npx ts-reap check

# Or with JSON output
npm run check:json
```

## What's Being Tested

1. ✅ Used exports are not reported
2. ✅ Unused exports are detected
3. ✅ Entry file exports are allowed to be unused
4. ✅ Both value exports (functions, constants) and type exports (interfaces, types) are checked
