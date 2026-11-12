from supervisor import *
import sys,unittest,tempfile
from unittest import mock
sys.path.insert(0,str(REPO/'test/toyvm-kernel-profile-accounting-backend-oct28'))
import test_setattr_evidence as se
class Short(se.ShortDirectory):
 def __enter__(self):return self.name
 def __exit__(self,*args):self.cleanup()
se.ShortDirectory=Short
names=['test_io_evidence','test_setattr_evidence','test_rename_wire','test_namespace_wire','test_create_mkdir_wire','test_namespace_integration']
suite=unittest.defaultTestLoader.loadTestsFromNames(names)
assert suite.countTestCases()==32,suite.countTestCases()
with mock.patch.object(tempfile,'TemporaryDirectory',Short):result=unittest.TextTestRunner(verbosity=1).run(suite)
assert result.wasSuccessful()
