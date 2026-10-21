"""Generate an ignored local environment without printing secrets."""
from pathlib import Path
import secrets
from cryptography.fernet import Fernet

if __name__=='__main__':
    path=Path('.env')
    if path.exists():raise SystemExit('.env already exists; it was not changed.')
    template=Path('api/.env.example').read_text()
    template=template.replace('JWT_SECRET=\n','JWT_SECRET='+secrets.token_urlsafe(64)+'\n').replace('ENCRYPTION_KEY=\n','ENCRYPTION_KEY='+Fernet.generate_key().decode()+'\n')
    path.write_text(template)
    print('Created ignored .env with fresh local secrets. No credentials printed.')
