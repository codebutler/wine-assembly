# Retained-output transport
"""Inlined into the SHA-pinned supervisor by transformSupervisor.

Only the supervisor owns the retained log. The child inherits a pipe, so its
artifact RLIMIT_FSIZE cannot enlarge retained stdout/stderr, even at fast exit.
"""
class RetainedOutput:
 def __init__(self, pipe, log):
  self.pipe=pipe;self.log=log;self.bytes=0;self.capped=False;self.eof=False
  self.tail=b'';self.fault=False
  os.set_blocking(pipe.fileno(),False)
 def drain(self):
  # Bound each turn as well as retention; reaching the cap terminates the run.
  parts=[]
  while not self.capped and not self.eof and not self.fault:
   try:part=os.read(self.pipe.fileno(),min(8192,131072-self.bytes))
   except BlockingIOError:break
   if not part:self.eof=True;break
   written=self.log.write(part)
   if written!=len(part):raise OSError('retained output short write')
   self.bytes+=written;parts.append(part)
   self.tail=(self.tail+part)[-16384:]
   self.fault=bool(re.search(rb'RuntimeError:|unreachable|\[crash\]|png FAILED|capture byte limit|capture dimensions',self.tail))
   self.capped=self.bytes==131072
  self.log.flush()
  return b''.join(parts)
 def close(self):
  self.pipe.close()
