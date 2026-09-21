/* Native USER reference, deliberately independent of emulator assertions. */
#include <windows.h>
unsigned long _tls_index = 0;
static HANDLE serial;
static int clicks;
static void row(const char *label, int a, int b, int c, int d) {
  char buf[160]; DWORD written;
  wsprintfA(buf, "%s %d %d %d %d\r\n", label, a, b, c, d);
  WriteFile(serial, buf, lstrlenA(buf), &written, NULL);
}
static LRESULT CALLBACK proc(HWND h, UINT m, WPARAM w, LPARAM l) {
  if (m == WM_COMMAND && HIWORD(w) == BN_CLICKED) clicks++;
  return DefWindowProcA(h, m, w, l);
}
void WINAPI WinMainCRTStartup(void) {
  WNDCLASSA wc = {0}; HWND parent, button; int kind, before, after;
  serial = CreateFileA("COM1", GENERIC_WRITE, 0, NULL, OPEN_EXISTING, 0, NULL);
  wc.lpfnWndProc = proc; wc.hInstance = GetModuleHandleA(NULL);
  wc.lpszClassName = "ButtonReference";
  RegisterClassA(&wc);
  parent = CreateWindowA(wc.lpszClassName, "Button reference", WS_OVERLAPPEDWINDOW | WS_VISIBLE,
    20, 20, 300, 160, NULL, NULL, wc.hInstance, NULL);
  row("VERSION", GetVersion(), 0, 0, 0);
  for (kind = 0; kind <= 11; kind++) {
    button = CreateWindowA("BUTTON", "Test", WS_CHILD | WS_VISIBLE | WS_TABSTOP | kind,
      10, 10, 100, 24, parent, (HMENU)100, wc.hInstance, NULL);
    before = SendMessageA(button, WM_GETDLGCODE, 0, 0);
    SetFocus(button);
    after = SendMessageA(button, WM_GETDLGCODE, 0, 0);
    row("DLGC kind/before/focused/style", kind, before, after, GetWindowLongA(button, GWL_STYLE) & 15);
    clicks = 0;
    SendMessageA(button, WM_KEYDOWN, VK_SPACE, 1);
    SendMessageA(button, WM_KEYDOWN, VK_SPACE, 0x40000001);
    row("SPACE_DOWN kind/state/capture/clicks", kind, SendMessageA(button, BM_GETSTATE, 0, 0), GetCapture() == button, clicks);
    SendMessageA(button, WM_KEYUP, VK_SPACE, 0xc0390001);
    row("SPACE_UP kind/state/capture/clicks", kind, SendMessageA(button, BM_GETSTATE, 0, 0), GetCapture() == button, clicks);
    DestroyWindow(button);
  }
  row("BUTTON_INPUT_DONE", 0, 0, 0, 0);
  CloseHandle(serial);
  ExitProcess(0);
}
