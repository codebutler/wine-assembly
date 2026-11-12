'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {parseTasks} = require('./readers');
const {eligible, decide} = require('./work-watchdog');
const {browserApp} = require('./test-app-vm');

// Status/id/owner excerpts from the live ledger, 2026-10-20.
const ledger = `- [ ] Gameplay screenshot and FPS: wep16_tictacdp
  id: GAMEPLAY-wep16_tictacdp
  status: done (218fb34a2 + 1d3f4c304: one-player and two-player both play; reviewed by orchestrator)
  owner: claude:d44753dd (w6; assigned by orchestrator 2026-10-10T11:25Z)
- [ ] Gameplay screenshot and FPS: wep16_tictacdp
  id: GAMEPLAY-wep16_tictacdp
  status: duplicate (stale copy of the GAMEPLAY-wep16_tictacdp entry above: done-partial 218fb34a2; the computer-turn stall is TICTACDP-COMPUTER-TURN-20261010)
  owner: unowned (w5 claimed this copy 17:42Z by mistake and released it 18:08Z; reconfirmation run scratch/runs/20261010T1803Z-wep16_tictacdp-player-move matches docs/re-notes/wep16-tictacdp.md, nothing new)
- [ ] Unreal-family --app launches crash on a fresh candidate fetch
  id: UNREAL-APP-FRESH-FETCH-20261010
  status: duplicate (of UT2004-FRESH-FETCH-MANIFEST-20261010, filed by the orchestrator a minute earlier; w5 owns that one and covers ut2003/unreal special there)
  owner: unowned (filed by claude:90024109 w5)
`;
const row = (id, status, box=' ') => `- [${box}] ${id}\n  id: ${id}\n  owner: codex:test\n${status ? `  status: ${status}\n` : ''}`;

test('actual unchecked duplicate records retain provenance without becoming ready or done', () => {
  const tasks = parseTasks(ledger);
  assert.deepEqual(tasks.map(t=>t.status), ['done','duplicate','duplicate']);
  assert.equal(tasks.length, 3);
  assert.equal(tasks[0].id, tasks[1].id);
  assert.equal(tasks[0].editable, false);
  assert.equal(tasks[1].replyAllowed, false);
  assert.match(tasks[1].body, /done-partial 218fb34a2/);
  assert.match(tasks[2].body, /of UT2004-FRESH-FETCH-MANIFEST-20261010/);
  assert.equal(tasks[2].line, 9);
});

test('explicit duplicate overrides every checkbox and legacy prose; never completes a dependency', () => {
  for (const box of [' ','x','X','~','!']) {
    const tasks = parseTasks(row('D','duplicate (of canonical)',box) + row('R','ready') + '  depends-on: D\n');
    assert.equal(tasks[0].status,'duplicate');
    assert.deepEqual(eligible(tasks,'codex:test'),[]);
  }
  assert.equal(parseTasks('## Historical\nstatus: duplicate (of canonical)')[0].status,'duplicate');
});

test('fenced examples cannot mark real ready work duplicate or reopen a duplicate', () => {
  for (const fence of ['```','~~~']) {
    const example = `${fence}md\nstatus: duplicate (example)\n- [ ] Example\n  id: EXAMPLE\n${fence}\n`;
    assert.deepEqual(parseTasks(row('R','') + example).map(t=>[t.id,t.status]),[['R','ready']]);
    const hiddenReady = `${fence}md\nstatus: ready\n- [ ] Example\n${fence}\n`;
    assert.deepEqual(parseTasks(row('D','duplicate (of canonical)') + hiddenReady).map(t=>[t.id,t.status]),[['D','duplicate']]);
  }
});

test('recognized statuses, terminal annotations, unknown tokens and checkbox fallback remain compatible', () => {
  for (const status of ['backlog','ready','active','blocked','review','deferred','done']) {
    assert.equal(parseTasks(row('T',`${status} (annotation)`))[0].status,status);
  }
  for (const [box,status] of [[' ','ready'],['x','done'],['X','done'],['~','active'],['!','blocked']]) {
    for (const explicit of ['', 'future-status (unknown)', 'duplicate-ish']) {
      assert.equal(parseTasks(row('T',explicit,box))[0].status,status);
    }
  }
  assert.equal(parseTasks('## History\nstatus: future-status')[0].status,'unknown');
});

test('duplicate IDs remain separate; a genuine ready row is still actionable', () => {
  const tasks = parseTasks(row('SAME','duplicate (old copy)') + row('SAME','ready'));
  assert.deepEqual(tasks.map(t=>t.editable),[false,false]);
  assert.deepEqual(eligible(tasks,'codex:test').map(t=>t.status),['ready']);
});

test('production watchdog and dashboard exclude duplicates but retain ready work and visible history', () => {
  const tasks = parseTasks(row('D','duplicate (of canonical)'));
  const agent = {id:'codex:test',provider:'codex',state:'idle',lastActivityAt:new Date().toISOString()};
  const snapshot = {tasks, agents:[agent], terminals:[], approvals:{items:[]}, candidates:[], runs:[], activity:[], warnings:[]};
  const terminal = {id:'test',agentId:agent.id,idle:true};
  assert.equal(decide(snapshot,terminal,{enabled:true,idleMs:0}).send,false);
  const ctx = browserApp(snapshot);
  assert.notEqual(vm.runInContext('agentSignal(state.agents[0]).stopped',ctx),true);
  assert.equal(vm.runInContext('taskState("duplicate")[1]',ctx),'Duplicate');
  assert.match(vm.runInContext('tasksView()',ctx),/Duplicate/);
  assert.doesNotMatch(vm.runInContext('overview()',ctx),/data-task="D"/);
  tasks.push(...parseTasks(row('R','ready')));
  assert.deepEqual(eligible(tasks,agent.id).map(t=>t.id),['R']);
  assert.equal(decide(snapshot,terminal,{enabled:true,idleMs:0}).send,true);
  assert.equal(vm.runInContext('agentSignal(state.agents[0]).stopped',ctx),true);
  assert.match(vm.runInContext('overview()',ctx),/data-task="R"/);
});
