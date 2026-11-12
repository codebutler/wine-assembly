from supervisor import *
p=R/'.git/info/sparse-checkout'
p.write_text(p.read_text()+'/docs/reviews/enigma-atomic-click-independent-accept-oct26/\n')
g('read-tree','-mu','HEAD')
