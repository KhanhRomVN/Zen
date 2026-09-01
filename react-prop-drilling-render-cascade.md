# React: Prop Drilling gây Render Cascade & FPS Drop — Context Reference

> File này dùng làm ngữ cảnh cho AI coding agent khi review/viết code React trong dự án.
> Khi agent gặp pattern "prop truyền từ root xuống nhiều tầng con", hoặc "state đổi liên tục gây giật UI",
> hãy đọc và áp dụng các nguyên tắc dưới đây trước khi đề xuất giải pháp.

---

## 1. Vấn đề (Problem Statement)

Khi một prop được truyền từ component root xuống hàng chục component con qua nhiều tầng
(prop drilling), mỗi lần giá trị prop đó thay đổi:

- React re-render lại **toàn bộ cây con** đang nhận prop đó (mặc định, trừ khi có memoization).
- Nếu tần suất thay đổi cao (ví dụ 10 lần/giây — mouse move, scroll, socket data, animation),
  cascade re-render này xảy ra liên tục → **giật FPS, lag input, tốn CPU**.
- Vấn đề nặng hơn nếu các component con có logic nặng (list dài, chart, canvas, form phức tạp).

**Nguyên nhân gốc rễ:** dùng cơ chế render của React (props/state/Context mặc định) cho dữ liệu
có tần suất thay đổi vượt quá tốc độ mà UI thực sự cần hiển thị lại.

---

## 2. Nguyên tắc quyết định (Decision Rule)

> **Không dùng props/Context/setState mặc định của React cho bất cứ giá trị nào đổi nhanh hơn
> tốc độ người dùng cần thấy trên màn hình.**

Trước khi chọn giải pháp, agent cần phân loại prop/state theo bảng sau:

| Đặc điểm state | Tần suất đổi | Số component phụ thuộc | Giải pháp khuyến nghị |
|---|---|---|---|
| UI state thông thường (modal open, tab active, filter) | Thấp (người dùng thao tác) | Ít | props bình thường / `useState` tại chỗ |
| Global state dùng ở nhiều nơi nhưng đổi ít | Thấp–Trung bình | Nhiều, rải rác | Context tách nhỏ theo domain, hoặc Zustand/Jotai |
| Global state, nhiều component subscribe từng phần khác nhau | Trung bình | Rất nhiều | Store có selector (Zustand/Jotai/Redux+reselect) |
| Animation, drag, scroll position, mouse tracking | Cao (mỗi frame, có thể 60 lần/giây) | Thường 1–2 component | **Bypass React render**: `ref` + mutate DOM trực tiếp / RAF / signals |
| Realtime data (socket, giá cổ phiếu, sensor) | Cao, không đều | 1 vài component hiển thị | Store ngoài React (transient update) + throttle |

---

## 3. Các giải pháp cụ thể

### 3.1. Giảm phạm vi ảnh hưởng của prop drilling (kiến trúc, không cần thư viện)

**a) State colocation**
Đặt state gần nhất có thể với nơi nó được dùng. Đừng lift state lên root "cho chắc" nếu
chỉ 2-3 component con cần nó.

```jsx
// ❌ State ở root, drill qua nhiều tầng không cần thiết
function App() {
  const [tooltipPos, setTooltipPos] = useState(null);
  return <Layout><Sidebar /><Content tooltipPos={tooltipPos} /></Layout>;
}

// ✅ State đặt ngay trong component cần nó
function Content() {
  const [tooltipPos, setTooltipPos] = useState(null);
  return <ChartArea tooltipPos={tooltipPos} setTooltipPos={setTooltipPos} />;
}
```

**b) Children-as-props (Component Composition)**
Khi Parent re-render do state đổi, nếu `children` được truyền dưới dạng prop (JSX đã dựng sẵn
từ component cha của Parent), React tái sử dụng reference đó — các component con trong
`children` **không** bị re-render lại dù Parent re-render.

```jsx
// ❌ Tất cả con đều re-render khi Parent đổi state nội bộ
function Parent({ value }) {
  const [internal, setInternal] = useState(0);
  return (
    <div onClick={() => setInternal(v => v + 1)}>
      <Heavy1 />
      <Heavy2 />
      <ValueDisplay value={value} />
    </div>
  );
}

// ✅ Heavy1, Heavy2 được truyền như children từ ngoài, không re-render theo `internal`
function Parent({ value, children }) {
  const [internal, setInternal] = useState(0);
  return (
    <div onClick={() => setInternal(v => v + 1)}>
      {children}
      <ValueDisplay value={value} />
    </div>
  );
}

// Dùng:
<Parent value={value}>
  <Heavy1 />
  <Heavy2 />
</Parent>
```

**c) Tách Context theo domain**
Không gộp toàn bộ app state vào 1 Context. Tách theo nhóm chức năng (auth, theme, cart...) để
component chỉ subscribe đúng phần liên quan.

### 3.2. Selector-based subscription (thư viện state management)

Đây là giải pháp phổ biến nhất ở dự án lớn để thay thế prop drilling triệt để:

- **Zustand** — `useStore(state => state.slice)`, component chỉ re-render khi `slice` đổi.
- **Jotai** — atom-based, mỗi component chỉ subscribe atom nó dùng.
- **Redux + reselect** — memoized selector tránh re-render khi phần state không liên quan đổi.
- **`use-context-selector`** — nếu vẫn muốn dùng Context API nhưng cần selector.

```jsx
// Zustand ví dụ
const useStore = create((set) => ({
  cursorPos: { x: 0, y: 0 },
  userName: 'Alice',
  setCursorPos: (pos) => set({ cursorPos: pos }),
}));

// Component chỉ re-render khi cursorPos đổi, KHÔNG re-render khi userName đổi
function Cursor() {
  const cursorPos = useStore((s) => s.cursorPos);
  return <div style={{ transform: `translate(${cursorPos.x}px,${cursorPos.y}px)` }} />;
}
```

### 3.3. Memoization (chặn re-render khi props không đổi)

```jsx
const Child = React.memo(function Child({ data }) {
  return <div>{data.label}</div>;
});
```

⚠️ Lưu ý: `React.memo` so sánh reference. Nếu component cha tạo object/array/function mới mỗi
lần render (`{ ...obj }`, `() => {}` inline), memo sẽ vô hiệu hóa. Cần `useMemo`/`useCallback`
đi kèm để giữ reference ổn định.

**Memo KHÔNG giải quyết được nếu prop thực sự đổi liên tục** — lúc đó phải dùng nhóm giải pháp 3.4.

### 3.4. High-frequency updates (10+ lần/giây): bypass hẳn React render

Đây là case nghiêm trọng nhất trong câu hỏi gốc. Nguyên tắc: **đừng đưa giá trị này vào
React state/props luôn** — dùng `ref` + mutate DOM trực tiếp.

```jsx
function DraggableBox() {
  const ref = useRef(null);
  const posRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    function handlePointerMove(e) {
      posRef.current = { x: e.clientX, y: e.clientY };
      // mutate DOM trực tiếp, KHÔNG setState -> không re-render React
      ref.current.style.transform =
        `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
    }
    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  return <div ref={ref} className="draggable-box" />;
}
```

Các kỹ thuật cùng nhóm:

- **`requestAnimationFrame` batching** — gom nhiều update trong 1 frame thành 1 lần apply.
- **Zustand transient updates** — `store.subscribe(callback)` ngoài React render cycle, tự
  mutate DOM/canvas trong callback thay vì setState.
- **Signals** (Preact Signals, SolidJS, `@preact/signals-react`) — fine-grained reactivity,
  chỉ update đúng DOM node phụ thuộc, không re-render component ở giữa. Đây là hướng nhiều
  team React lớn đang áp dụng cho case update tần suất cao.
- **Throttle/debounce** — nếu không cần hiển thị real-time tuyệt đối, giới hạn xuống ~16ms
  (tương đương 60fps) trước khi setState.
- **React 18 `useDeferredValue` / `useTransition`** — đánh dấu update là low-priority, React
  ngắt/trì hoãn khi có update quan trọng hơn cần xử lý trước.

```jsx
// Throttle bằng RAF trước khi đưa vào React state
function useThrottledState(initial) {
  const [state, setState] = useState(initial);
  const pending = useRef(null);
  const rafId = useRef(null);

  const setThrottled = useCallback((value) => {
    pending.current = value;
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      setState(pending.current);
      rafId.current = null;
    });
  }, []);

  return [state, setThrottled];
}
```

---

## 4. Checklist khi review/viết code liên quan đến prop này

Agent nên tự hỏi các câu sau trước khi implement:

1. **Prop này thực sự cần render lại UI mỗi lần đổi không?**
   Nếu chỉ cần mutate style/DOM (vị trí, opacity, transform...) → dùng `ref`, không dùng state.

2. **Bao nhiêu component thực sự phụ thuộc vào prop này?**
   Nếu chỉ 1–2 component ở tầng sâu → cân nhắc colocate state ở đó, hoặc dùng
   store có selector thay vì drill qua nhiều tầng trung gian không dùng đến.

3. **Tần suất đổi là bao nhiêu?**
   - < 1 lần/giây (user click, toggle...): props/state bình thường là đủ.
   - Vài lần/giây (typing, filter): cân nhắc debounce.
   - > 10 lần/giây (drag, scroll, animation, socket): bắt buộc bypass render (mục 3.4).

4. **Các component trung gian (không dùng prop) có bị re-render oan không?**
   Nếu có → áp dụng children-as-props hoặc `React.memo` + stable reference.

5. **Có đang gộp nhiều state không liên quan vào 1 Context/store lớn không?**
   Nếu có → tách nhỏ theo domain hoặc chuyển sang store có selector.

---

## 5. Tổng kết nhanh (TL;DR cho agent)

- Prop drilling tự nó không phải vấn đề — vấn đề là **re-render cascade không kiểm soát được**.
- Ưu tiên xử lý theo thứ tự: **kiến trúc (colocation/composition) → selector-based store →
  memoization → bypass React render (cho high-frequency)**.
- Không bao giờ dùng `setState`/props mặc định cho dữ liệu đổi nhanh hơn 1 frame (16ms) nếu
  không có throttle/RAF/signals đi kèm.
- Khi nghi ngờ giật FPS do render, luôn xác nhận bằng React DevTools Profiler trước khi tối ưu,
  tránh tối ưu sai chỗ.