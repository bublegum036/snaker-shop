"""Clean venv + copied source + fresh PostgreSQL, without deleting the working DB."""
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tempfile
import time
from uuid import uuid4
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from app.core.config import database_url

ROOT=Path(__file__).resolve().parent

def run():
    name='final_check_'+uuid4().hex
    url=make_url(database_url())
    admin=create_engine(url.set(database='postgres'),isolation_level='AUTOCOMMIT',connect_args={'connect_timeout':3})
    created=False;stages=[]
    try:
        with tempfile.TemporaryDirectory(prefix='sneaker-final-') as temp:
            copy=Path(temp)/'shop';copy.mkdir()
            for directory in ['app','alembic']:
                shutil.copytree(ROOT/directory,copy/directory,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
            for item in ROOT.iterdir():
                if item.is_file() and (item.suffix in {'.py','.txt','.ini','.md','.yaml'} or item.name in {'.env.example','.gitignore'}):
                    shutil.copy2(item,copy/item.name)
            assert not (copy/'.env').exists() and not (copy/'.venv').exists()
            env=os.environ.copy()
            for key in ['DATABASE_URL','JWT_SECRET','PYTHONPATH','PYTHONHOME','VIRTUAL_ENV']:
                env.pop(key,None)
            def step(label,args,timeout=120):
                start=time.monotonic()
                result=subprocess.run(args,cwd=copy,env=env,capture_output=True,text=True,timeout=timeout)
                if result.returncode:
                    # Only the stage name is public: diagnostics may contain local configuration.
                    raise RuntimeError('Clean verification failed at: '+label)
                stages.append({'stage':label,'passed':True,'seconds':round(time.monotonic()-start,2)})
                print('PASS',label,flush=True)
                return result.stdout
            step('new venv',[sys.executable,'-m','venv',str(copy/'.venv')])
            python=str(copy/'.venv'/('Scripts/python.exe' if os.name=='nt' else 'bin/python'))
            step('install pinned requirements',[python,'-m','pip','install','--disable-pip-version-check','-q','-r','requirements.txt'],240)
            step('pip check',[python,'-m','pip','check'])
            with admin.connect() as db:db.execute(text(f'CREATE DATABASE "{name}"'));created=True
            target=url.set(database=name)
            # The temporary .env is the only source of application configuration.
            value=target.render_as_string(hide_password=False)
            (copy/'.env').write_text('DATABASE_URL='+value+'\nJWT_SECRET=\n')
            step('generate local JWT key',[python,'setup_jwt.py'])
            step('migrate empty database',[python,'-m','alembic','upgrade','head'])
            step('seed catalog',[python,'-m','app.seed'])
            env['SNEAKER_FINAL_DISPOSABLE']='yes'
            step('final API acceptance',[python,'final_smoke.py'])
            smoke=json.loads((copy/'final-smoke-result.json').read_text())
            step('M2-M3 regression',[python,'verify_m23.py'])
            m23=json.loads((copy/'m23-verification.json').read_text())
            step('M4-M5 regression',[python,'verify_m45.py'])
            m45=json.loads((copy/'m45-verification.json').read_text())
            report={'environment':{'os':platform.system(),'python':platform.python_version(),'source':'temporary copy without existing .env or .venv','database':'new empty PostgreSQL database on existing lesson server','swagger':'HTTP /docs and OpenAPI checked; manual UI run is separate'},'stages':stages,**smoke,'regression':{'m23':len(m23['checks']),'m45':len(m45['checks'])},'cleanup':'temporary directory and databases removed; working volume preserved'}
    finally:
        if created:
            with admin.connect() as db:db.execute(text(f'DROP DATABASE "{name}"'))
        admin.dispose()
    serialized=json.dumps(report,ensure_ascii=False,indent=2)
    (ROOT/'final-verification.json').write_text(serialized+'\n')
    (ROOT/'final-verified.js').write_text('window.SNEAKER_FINAL = '+serialized+';\n')
    print('Clean run complete:',len(report['checks']),'final checks; regression',report['regression'])

if __name__=='__main__':run()
