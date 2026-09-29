import json, subprocess, time, os, hashlib
# MusicBrainz asks every client to say who it is: MB_CONTACT="you@example.com" python3 …
AGENT=f"graview-discography/0.1 ({os.environ.get('MB_CONTACT', 'graview example')})"
CACHE="cache"; os.makedirs(CACHE, exist_ok=True)
def get(url):
    key=os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest()+".json")
    if os.path.exists(key): return json.load(open(key))
    for i in range(6):
        out=subprocess.run(["curl","-s","-f","-A",AGENT,url],capture_output=True,text=True)
        if out.returncode==0:
            d=json.loads(out.stdout); json.dump(d,open(key,"w")); time.sleep(1.1); return d
        time.sleep(3+i*3)
    raise SystemExit("failed "+url)
