"""No-guest acceptance of current production input-state dispatch and legacy actions."""
import json
import pathlib
import select
import subprocess
import sys

R = pathlib.Path(__file__).resolve().parents[1]
O = pathlib.Path(sys.argv[1]); O.mkdir()
records = []
for mode in ('normal', 'input-state'):
    with (O / (mode + '.stderr')).open('wb') as err:
        p = subprocess.Popen(['/home/user/.nvm/versions/node/v24.18.1/bin/node',
            '--max-old-space-size=512', str(R / 'test/fixtures/generally-loading-current-protocol.cjs'),
            str(R / 'test/run.js'), mode, str(O / (mode + '.jsonl'))],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=err)
    wire = []
    def ask(cmd):
        p.stdin.write(json.dumps(cmd).encode() + b'\n'); p.stdin.flush()
        assert select.select([p.stdout], [], [], 3)[0], 'missing production ACK'
        raw = p.stdout.readline(); wire.append(raw.decode())
        assert raw.startswith(b'[ctl] '), raw
        ack = json.loads(raw[6:]); assert ack['id'] == cmd['id']
        return ack
    try:
        before = ask(dict(id='snapshot-before', action='snapshot'))['value']
        request = dict(id='read-one', action='input-state')
        first = ask(request)
        if mode == 'normal':
            assert first['ok'] is False and 'needs --trace-input-dispatch' in first['error']
        else:
            assert first['ok'] is True
            v = first['value']
            assert v['requestId'] == 'read-one' and v['batch'] == 0 and v['credits'] == 0 and v['frozen'] is True
            assert set(v['counters'].values()) == {0}
            assert v['queues']['scheduled']['count'] == 1 and v['queues']['renderer']['count'] == 1
            assert v['queues']['pending']['head'][0]['wParam'] == 32
            assert v['keys']['32']['_physicalKeys'] is True
            assert v['threads']['main']['state'] == 'parked' and v['sdlConsumption'] == 'unknown'
            assert ask(request) == first, 'read changed observation'
            for bad in (dict(id=7, action='input-state'), dict(id='extra', action='input-state', extra=1)):
                ack = ask(bad); assert ack['ok'] is False and 'needs only action' in ack['error']
        assert ask(dict(id='snapshot-after', action='snapshot'))['value'] == before
        step = ask(dict(id=20, action='step', n=2))
        assert step['ok'] and step['value'] == dict(batch=2, ran=2, steps=2, frozen=True)
        if mode == 'input-state':
            after = ask(request)['value']
            assert after == dict(v, batch=2), 'step changed parked observations beyond batch'
        snap = ask(dict(id=21, action='snapshot'))['value']
        assert snap['batch'] == 2 and snap['frozen']['credits'] == 0
        records.append(dict(mode=mode, accepted=True, step=step))
    finally:
        p.terminate(); p.wait(timeout=3)
        (O / (mode + '.wire')).write_text(''.join(wire))
        assert p.poll() is not None
(O / 'receipt.json').write_text(json.dumps(dict(records=records, cleanupComplete=True, guestInvocations=0), indent=2)+'\n')
print('PASS current production input-state real helper, read-only zero-credit observations, default-off refusal and legacy snapshot/step')
