import guard as g,json,hashlib,pathlib,sys
B=g.B;m=json.loads((B/'focused-manifest.json').read_text());r=json.loads(pathlib.Path(sys.argv[1]).read_text());rows={x['path']:x for x in m['files']}
for c in r['compiler']:
 assert c['sha256']==rows[c['file']]['sha256']
 c['blob']=rows[c['file']]['blob'];c['fullBytes']=rows[c['file']]['bytes']
for e in r['excerpts']:
 if e['file']=='import-signature-only':continue
 source=pathlib.Path(r['corePath']) if e['file']=='src/09ab-handlers-d3dim-core.wat' else B/'repo'/e['file']
 b=source.read_bytes()[e['startByte']:e['endByteExclusive']]
 assert len(b)==e['bytes'] and hashlib.sha256(b).hexdigest()==e['sha256']
r['inputRevision']=m['revision'];r['compilerExactIdentityCheck']='PASS';r['byteExactExtractionCheck']='PASS'
g.write(pathlib.Path(sys.argv[1]),r);print('compiler blobs/full SHA and byte-exact excerpts PASS')
