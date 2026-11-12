// Non-game fixture: execute byte-exact production controller + stdin adapter.
// No module, guest, compiler, media or emulator initialization is performed.
const fs = require('fs'), crypto = require('crypto');
const source = fs.readFileSync(process.argv[2], 'utf8');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
if (sha(source) !== '1655b299c95be6b2cd2ca8c951b880b0b8fbed81a0cd785300d3bed5f24ae39c')
  throw new Error('pinned production runner mismatch');
const start = source.indexOf('  const liveOutstanding = new Map();');
const end = source.indexOf('\n\n  // A rejected async loader/yield', start);
if (start < 0 || end < 0) throw new Error('production boundary not found');
const boundary = source.slice(start, end);
if (sha(boundary) !== '366711bfa9a7eb1694104a63368361370e8612eb002a3d5b4acc025d2fd9a5a1') throw new Error('current boundary mismatch');
const mode = process.argv[3] || 'normal';
const trace = process.argv[4];
const log = row => fs.appendFileSync(trace, JSON.stringify(row) + '\n');
log({sourceSHA256: sha(source), boundarySHA256: sha(boundary), start, end,
     node: process.execPath, flags: process.execArgv, limits: fs.readFileSync('/proc/self/limits','utf8')});
const tickState = {batch: 0};
// Only host observation dependencies are fake. Step scheduling, completion,
// snapshots, input-message validation and stdin ACK envelopes are production.
const context = {
  CONTROL: false, CONTROL_STDIN: true, CONTROL_FROZEN_START: true,
  signalExitWake: null, stopped: false, deadlineMs: 0, tickState,
  batchClock: {getTickMsPerBatch: () => 2}, videoRecorder: null,
  renderer: {windows: {}, canvas: {width: 800, height: 600}},
  instance: {exports: {get_eip: () => 0, get_quit_flag: () => false,
    get_yield_reason: () => 0, post_message_q: () => 1}},
  fs, require, console, canvasToPng: () => Buffer.from('fixture-not-a-frame'),
};
// Real current-main helper, no transitive requires. Parked observations only.
const { createInputConsumptionTrace } = require('../input-consumption-trace');
const scheduledInput = Object.freeze([{action: 'keydown', batch: 7, wParam: 32}]);
const crossThreadMsgs = Object.freeze([]), inputQueue = Object.freeze([]);
const inputEvent = Object.freeze({hwnd: 1, msg: 256, wParam: 32, lParam: 0});
context.renderer.inputQueue = Object.freeze([{...inputEvent}]);
context.renderer._physicalKeys = Object.freeze({32: true});
context.renderer._asyncKeys = Object.freeze({32: true});
context.renderer._asyncPressedKeys = Object.freeze({32: false});
const threadManager = {backend: 'fixture-parked', threads: new Map(),
  _mainThreadState: {state: 'parked', suspendCount: 0}, _mainSleepUntil: 0};
const inputConsumptionTrace = createInputConsumptionTrace({
  enabled: mode === 'input-state', logs: [],
  snapshot: () => { throw new Error('frozen read spent clock probe'); },
});
Object.assign(context, {inputConsumptionTrace, scheduledInput, crossThreadMsgs,
  inputQueue, inputEvent, threadManager});
const names = Object.keys(context);
const factory = new Function(...names, boundary + '\nreturn {waitForControlBatch, finishPreviousControlBatch, controlSnapshot, control};');
const ctl = factory(...names.map(k => context[k]));
const write = process.stdout.write.bind(process.stdout);
let duplicateDone = false;
process.stdout.write = (data, ...args) => {
  let text = String(data);
  if (text.startsWith('[ctl] ')) {
    const ack = JSON.parse(text.slice(6));
    const isStep = ack.value && ack.value.ran !== undefined;
    log({ack});
    if (isStep && mode === 'missing') return true;
    if (isStep && mode === 'exit') process.exit(7);
    if (isStep && mode === 'wrong-id') ack.id += 77;
    if (isStep && mode === 'negative') {ack.ok = false; ack.error = 'fixture rejected';}
    if (isStep && mode === 'wrong-count') ack.value.ran--;
    if (isStep && mode === 'wrong-steps') ack.value.steps--;
    if (isStep && mode === 'wrong-batch') ack.value.batch++;
    if (isStep && mode === 'not-frozen') ack.value.frozen = false;
    if (!isStep && ack.value && ack.value.batch > 0 && ack.value.frozen) {
      if (mode === 'credits') ack.value.frozen.credits = 1;
      if (mode === 'quit') ack.value.quit = true;
      if (mode === 'snapshot-batch') ack.value.batch++;
    }
    text = '[ctl] ' + JSON.stringify(ack) + '\n';
    if (isStep && mode === 'delayed') {setTimeout(() => write(text), 250); return true;}
    if (isStep && mode === 'duplicate' && !duplicateDone) {duplicateDone = true; text += text;}
  }
  return write(text, ...args);
};
process.stdin.on('data', data => {
  for (const line of String(data).trim().split('\n')) {
    if (!line) continue;
    const request = JSON.parse(line);
    log({request, before: ctl.controlSnapshot()});
  }
});
// A light stand-in for batch execution: real completion accounting once/batch,
// with one 3ms host yield per 1000 batches. An oversized 100000 request outlives
// a scaled 0.12-second response allowance. There is no fabricated step ACK.
(async () => {
  while (true) {
    await ctl.waitForControlBatch();
    if (tickState.batch % 1000 === 0) await new Promise(r => setTimeout(r, 3));
    tickState.batch++;
    ctl.finishPreviousControlBatch();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
