/* Native reference, not an emulator assertion. Output must end in DONE. */
#include <windows.h>
unsigned long _tls_index = 0;
static HANDLE serial;
static HWND a, b, child;
static int answer = -1, queries, recording;

static void emit(const char *s) {
  DWORD written;
  if (serial != INVALID_HANDLE_VALUE)
    WriteFile(serial, s, lstrlenA(s), &written, NULL);
}
static int id(HWND h) { return h == a ? 1 : h == b ? 2 : h == child ? 3 : 0; }
static void row(const char *label, int x, int y, int z, int w) {
  char buf[160];
  wsprintfA(buf, "%s %d %d %d %d\r\n", label, x, y, z, w);
  emit(buf);
}
static LRESULT CALLBACK proc(HWND h, UINT m, WPARAM w, LPARAM l) {
  if (m == WM_MOUSEACTIVATE) {
    queries++;
    if (recording) row("QUERY hwnd/top/hit/msg", id(h), id((HWND)w), LOWORD(l), HIWORD(l));
    if (answer >= 0) return answer;
  }
  if (recording && (m == WM_ACTIVATE || m == WM_SETFOCUS ||
                    m == WM_KILLFOCUS || m == WM_LBUTTONDOWN || m == WM_LBUTTONUP))
    row("DISPATCH hwnd/msg/wp/active", id(h), m, (int)w, id(GetActiveWindow()));
  return DefWindowProcA(h, m, w, l);
}
static void drain(void) {
  MSG msg;
  int guard = 0;
  while (guard++ < 100 && PeekMessageA(&msg, NULL, 0, 0, PM_REMOVE)) {
    TranslateMessage(&msg);
    DispatchMessageA(&msg);
  }
}
static void peek(const char *label, UINT flags) {
  MSG msg;
  BOOL got = PeekMessageA(&msg, NULL, WM_LBUTTONDOWN, WM_LBUTTONDOWN, flags);
  row(label, got, got ? msg.message : 0, queries, id(GetActiveWindow()));
  if (got && flags == PM_REMOVE) DispatchMessageA(&msg);
}
void WINAPI WinMainCRTStartup(void) {
  WNDCLASSA wc = {0};
  int hits[] = {HTCLIENT, HTCAPTION, HTSYSMENU, HTMINBUTTON, HTMAXBUTTON};
  int msgs[] = {WM_LBUTTONDOWN, WM_RBUTTONDOWN, WM_NCLBUTTONDOWN};
  int i, j, mode;
  POINT pt;
  serial = CreateFileA("COM1", GENERIC_WRITE, 0, NULL, OPEN_EXISTING, 0, NULL);
  emit("MOUSE_ACTIVATE_V1\r\n");
  wc.lpfnWndProc = proc;
  wc.hInstance = GetModuleHandleA(NULL);
  wc.lpszClassName = "MouseActivationReference";
  wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
  if (!RegisterClassA(&wc)) { emit("FAIL register\r\n"); ExitProcess(1); }
  a = CreateWindowA(wc.lpszClassName, "A", WS_OVERLAPPEDWINDOW | WS_VISIBLE,
                    10, 30, 240, 200, NULL, NULL, wc.hInstance, NULL);
  b = CreateWindowA(wc.lpszClassName, "B", WS_OVERLAPPEDWINDOW | WS_VISIBLE,
                    300, 30, 240, 200, NULL, NULL, wc.hInstance, NULL);
  child = CreateWindowA(wc.lpszClassName, "child", WS_CHILD | WS_VISIBLE,
                        10, 100, 100, 40, b, NULL, wc.hInstance, NULL);
  if (!a || !b || !child) { emit("FAIL windows\r\n"); ExitProcess(1); }
  row("VERSION", (int)GetVersion(), 0, 0, 0);
  for (i = 0; i < 5; i++) for (j = 0; j < 3; j++)
    row("DEFAULT hit/msg/result", hits[i], msgs[j],
        DefWindowProcA(b, WM_MOUSEACTIVATE, (WPARAM)b, MAKELPARAM(hits[i], msgs[j])), 0);
  recording = 1;
  for (mode = 0; mode <= 4; mode++) {
    answer = mode;
    queries = 0;
    i = DefWindowProcA(child, WM_MOUSEACTIVATE, (WPARAM)b, MAKELPARAM(HTCLIENT, WM_LBUTTONDOWN));
    row("PARENT answer/result/queries", mode, i, queries, 0);
  }
  for (mode = -1; mode <= 4; mode++) {
    recording = 0;
    answer = mode;
    SetForegroundWindow(a);
    SetActiveWindow(a);
    pt.x = 50; pt.y = 50;
    ClientToScreen(b, &pt);
    SetCursorPos(pt.x, pt.y);
    drain();
    queries = 0;
    recording = 1;
    row("CASE answer/active", mode, id(GetActiveWindow()), 0, 0);
    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
    Sleep(50);
    row("INJECT queries/active", queries, id(GetActiveWindow()), 0, 0);
    peek("PEEK1 got/msg/queries/active", PM_NOREMOVE);
    peek("PEEK2 got/msg/queries/active", PM_NOREMOVE);
    peek("REMOVE got/msg/queries/active", PM_REMOVE);
    drain();
    recording = 0;
    SetActiveWindow(a);
    drain();
    queries = 0;
    recording = 1;
    PostMessageA(b, WM_LBUTTONDOWN, MK_LBUTTON, MAKELPARAM(50, 50));
    peek("POST got/msg/queries/active", PM_REMOVE);
  }
  emit("MOUSE_ACTIVATE_DONE\r\n");
  CloseHandle(serial);
  ExitProcess(0);
}
