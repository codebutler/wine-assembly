from control import *
limits()
label=sys.argv[1]
dump(O/(label+'-owner.json'),dict(pid=os.getpid(),uid=os.getuid(),startTicks=read('/proc/self/stat').decode().split()[21],argv=sys.argv))
print(run(label,['timeout','--signal=TERM','--kill-after=5','55','tail','-n','0','-f',str(ROOT/'messageboard.txt')],B,expected=124))
dump(O/(label+'-cleanup.json'),dict(reaped=True,exit=124,otherProcessesSignalled=0))
