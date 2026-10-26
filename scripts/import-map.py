#!/usr/bin/env python3
"""One-time OSM XML download/cache + deterministic, geometry-preserving graph extraction."""
import gzip, json, math, pathlib, xml.etree.ElementTree as ET, urllib.request, datetime, hashlib
ROOT=pathlib.Path(__file__).resolve().parents[1]; RAW=ROOT/'data/oxford.osm.xml'
URL='https://www.openstreetmap.org/api/0.6/map?bbox=-1.2615,51.7504,-1.2518,51.7568'
if not RAW.exists() and RAW.with_suffix(RAW.suffix+'.gz').exists():
    RAW.write_bytes(gzip.decompress(RAW.with_suffix(RAW.suffix+'.gz').read_bytes()))
if not RAW.exists():
    req=urllib.request.Request(URL,headers={'User-Agent':'OxfordAfterDark-local-game/1.0'})
    with urllib.request.urlopen(req, timeout=45) as r: RAW.write_bytes(r.read())
provenance_path=ROOT/'data/provenance.json'
if not provenance_path.exists():
    provenance_path.write_text(json.dumps({'source':URL,'retrievedAt':datetime.datetime.fromtimestamp(RAW.stat().st_mtime,datetime.timezone.utc).isoformat(),'method':'Official OSM bbox API, downloaded once; raw XML retained. Overpass first returned capacity error.','bbox':[-1.2615,51.7504,-1.2518,51.7568]},indent=2))
provenance=json.loads(provenance_path.read_text())
r=ET.parse(RAW).getroot()
def project(lon,lat): return [(lon+1.2615)*111320*math.cos(math.radians(51.7536)),(51.7568-lat)*111320]
pts={n.get('id'):project(float(n.get('lon')),float(n.get('lat'))) for n in r.findall('node')}
allowed={'Broad Street','Holywell Street','Parks Road','Catte Street','Radcliffe Square','Brasenose Lane',"St Mary's Passage",'New College Lane',"Queen's Lane",'High Street','Turl Street','Market Street','Ship Street','Cornmarket Street','Magpie Lane','Oriel Street','Oriel Square','Merton Street','King Edward Street','Alfred Street','Bear Lane','Blue Boar Street',"St Aldate's",'Carfax','Queen Street','George Street',"St Michael's Street"}
adj={}; segs={}; sourceways=set()
def inside(p): return 55<=p[0]<=655 and 110<=p[1]<=620
for w in r.findall('way'):
    t={t.get('k'):t.get('v') for t in w.findall('tag')}; name=t.get('name')
    if name not in allowed or not t.get('highway') or t.get('area')=='yes' or t.get('highway')=='footway': continue
    if t.get('access') in ('no','private') and t.get('foot') not in ('yes','designated'): continue
    refs=[n.get('ref') for n in w.findall('nd')]
    for a,b in zip(refs,refs[1:]):
        if a not in pts or b not in pts or not inside(pts[a]) or not inside(pts[b]) or a==b: continue
        key=tuple(sorted((a,b))); segs[key]=(name,w.get('id')); sourceways.add(w.get('id'))
        adj.setdefault(a,set()).add(b); adj.setdefault(b,set()).add(a)
components=[]; remaining=set(adj)
while remaining:
    todo=[min(remaining)]; comp=set(todo)
    while todo:
        for b in adj[todo.pop()]:
            if b not in comp:comp.add(b);todo.append(b)
    remaining-=comp; components.append(comp)
keep=max(components,key=len)
# Preserve junctions, dead ends, named-road changes. Extra waypoints break long roads into manageable clicks.
anchors={a for a in keep if len(adj[a])!=2 or len({segs[tuple(sorted((a,b)))][0] for b in adj[a]})>1}
for a in sorted(keep):
    if a in anchors:continue
    # Long chains subdivided below; source geometry remains unchanged.
visited=set(); edges=[]
for start in sorted(anchors):
 for neighbor in sorted(adj[start]):
    if tuple(sorted((start,neighbor))) in visited:continue
    chain=[start]; prev=start; cur=neighbor
    while True:
        visited.add(tuple(sorted((prev,cur))));chain.append(cur)
        if cur in anchors:break
        nxt=next(b for b in adj[cur] if b!=prev);prev,cur=cur,nxt
    part=[chain[0]]; length=0
    for a,b in zip(chain,chain[1:]):
        length+=math.dist(pts[a],pts[b]);part.append(b)
        if length>=80 or b==chain[-1]:
            if len(part)>1:
                name,way=segs[tuple(sorted((part[0],part[1])))]; edges.append({'a':part[0],'b':b,'length':round(length,4),'geometry':[pts[x] for x in part],'name':name,'osmWay':way})
                anchors.add(part[0]);anchors.add(b)
            part=[b];length=0
used=sorted({x for e in edges for x in (e['a'],e['b'])}); ids={s:i for i,s in enumerate(used)}
nodes=[{'id':ids[s],'osm':s,'x':round(pts[s][0],3),'y':round(pts[s][1],3)} for s in used]
for i,e in enumerate(edges):e.update(id=i,a=ids[e['a']],b=ids[e['b']]);e['geometry']=[[round(x,3),round(y,3)] for x,y in e['geometry']]
buildings=[]
for w in r.findall('way'):
 t={t.get('k'):t.get('v') for t in w.findall('tag')};refs=[n.get('ref') for n in w.findall('nd')]
 if t.get('building') and len(refs)>3 and all(x in pts for x in refs):
    poly=[pts[x] for x in refs]
    if any(inside(p) for p in poly):buildings.append({'geometry':[[round(x,2),round(y,2)] for x,y in poly],'name':t.get('name','')})
meta={'source':URL,'retrievedAt':provenance['retrievedAt'],'processedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rawSHA256':hashlib.sha256(RAW.read_bytes()).hexdigest(),'license':'ODbL 1.0','attribution':'© OpenStreetMap contributors','projection':'local equirectangular, metres; lon0=-1.2615, lat0=51.7568, reference latitude=51.7536','processing':'Curated named streets; excluded areas, footways and non-foot-accessible private roads; clipped to local x=55..655 y=110..620; largest connected component; degree-2 chains contracted with full geometry, subdivided at existing OSM points after 80m; all edges bidirectional for gameplay. No synthetic connecting roads.','discardedComponents':[len(c) for c in components if c!=keep],'sourceWays':sorted(sourceways),'originalConnectedVertices':len(keep)}
out={'meta':meta,'nodes':nodes,'edges':edges,'buildings':buildings,'bounds':[35,90,685,645]}
(ROOT/'data/map.json').write_text(json.dumps(out,separators=(',',':')))
print(json.dumps({'nodes':len(nodes),'edges':len(edges),'buildings':len(buildings),'extent':out['bounds'],'discardedComponents':meta['discardedComponents']}))
# Useful for selecting scenario coordinates without changing geometry.
for n in nodes:
 names=sorted({e['name'] for e in edges if n['id'] in (e['a'],e['b'])})
 print(n['id'],round(n['x']),round(n['y']),'/'.join(names))
