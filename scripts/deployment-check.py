"""Read-only, redacted deployment preflight. Does not provision hosts or claim provider acceptance."""
import json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from api.config import Settings
from api.models import database
from sqlalchemy import text

def main():
    s=Settings();checks={}
    try:s.validate();checks['configuration']='pass'
    except RuntimeError as e:checks['configuration']=str(e)
    checks['production_mode']='pass' if s.environment=='production' else 'not production'
    checks['postgresql']='configured' if s.database_url.startswith('postgresql') else 'not configured'
    checks['smtp']='configured; delivery unverified' if s.smtp_host and s.mail_from else 'missing'
    checks['stripe']='configured; lifecycle unverified' if s.stripe_key and s.webhook_key and s.monthly_price and s.annual_price else 'missing'
    checks['ai']='configured; provider unverified' if s.ai_enabled and s.ai_key and s.ai_model else 'disabled or missing'
    try:
        if not s.database_url.startswith('postgresql'):raise RuntimeError('Production PostgreSQL is not configured')
        engine,_=database(s.database_url)
        with engine.connect() as c:
            c.execute(text('SELECT 1'));versions=set(c.execute(text('SELECT version FROM schema_migrations')).scalars());checks['database_schema']='pass' if {'0001','0002','0003','0004'}<=versions else 'migration required'
        engine.dispose()
    except Exception:checks['database_schema']='unreachable or migration required'
    print(json.dumps(checks,indent=2));return 0 if all(checks.get(k)=='pass' for k in ['configuration','production_mode','database_schema']) and checks['postgresql']=='configured' and checks['smtp'].startswith('configured') else 1

if __name__=='__main__':raise SystemExit(main())
