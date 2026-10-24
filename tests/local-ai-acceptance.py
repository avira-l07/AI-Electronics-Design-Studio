"""Explicit synthetic inference acceptance; installed local model only, no downloads."""
import json
import sys
import time
from pathlib import Path
from cryptography.fernet import Fernet
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from api.config import Settings
from api.features import ask_provider
from api.ai_modelling import recipe, SCHEMA

def main():
    settings=Settings(environment='test',origin='http://127.0.0.1:4203',
        jwt_key='synthetic-local-acceptance-key-'*3,encryption_key=Fernet.generate_key().decode(),
        billing_enabled=False,allow_live_billing=False,stripe_key='',free_beta=True,
        ai_enabled=True,ai_provider='ollama',ollama_model='phi4-mini:3.8b',ai_key='')
    settings.validate()
    started=time.monotonic()
    answer=ask_provider(settings,
        'Make a rectangular plate in millimetres. Name: Local test plate. Depth: 8. Plane: XZ. '
        'Outline vertices in order: [-40,-25], [40,-25], [40,25], [-40,25]. '
        'Two round through holes: diameter 6 at u=-25,v=0 and diameter 6 at u=25,v=0. '
        'Return the requested schema with outline coordinates as pairs of numbers.',schema=SCHEMA)
    proposed=recipe(json.loads(answer))
    directory=Path(__file__).resolve().parents[1]/'tmp'/'local-ai-acceptance'
    directory.mkdir(parents=True,exist_ok=True)
    (directory/'proposal.json').write_text(json.dumps(proposed),encoding='utf-8')
    print('PASS: actual installed phi4-mini:3.8b inference, validated recipe, no cloud API; '
          f'{time.monotonic()-started:.1f}s. Proposal only; no project changed.')

if __name__=='__main__':main()
