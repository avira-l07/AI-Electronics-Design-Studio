import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

@dataclass
class Settings:
    database_url: str = os.getenv('DATABASE_URL', 'sqlite:///./studio.db')
    origin: str = os.getenv('APP_ORIGIN', 'http://127.0.0.1:8000').rstrip('/')
    environment: str = os.getenv('APP_ENV', 'development')
    jwt_key: str = os.getenv('JWT_SECRET', '')
    encryption_key: str = os.getenv('ENCRYPTION_KEY', '')
    stripe_key: str = os.getenv('STRIPE_SECRET_KEY', '')
    billing_enabled: bool = os.getenv('BILLING_ENABLED', 'false').lower() == 'true'
    allow_live_billing: bool = os.getenv('ALLOW_LIVE_BILLING', 'false').lower() == 'true'
    webhook_key: str = os.getenv('STRIPE_WEBHOOK_SECRET', '')
    monthly_price: str = os.getenv('STRIPE_MONTHLY_PRICE_ID', '')
    annual_price: str = os.getenv('STRIPE_ANNUAL_PRICE_ID', '')
    google_client: str = os.getenv('GOOGLE_CLIENT_ID', '')
    google_secret: str = os.getenv('GOOGLE_CLIENT_SECRET', '')
    trial_days: int = int(os.getenv('TRIAL_DAYS', '0'))
    smtp_host: str = os.getenv('SMTP_HOST', '')
    smtp_port: int = int(os.getenv('SMTP_PORT', '587'))
    smtp_user: str = os.getenv('SMTP_USER', '')
    smtp_password: str = os.getenv('SMTP_PASSWORD', '')
    mail_from: str = os.getenv('MAIL_FROM', '')
    ai_key: str = os.getenv('OPENAI_API_KEY', '')
    ai_model: str = os.getenv('OPENAI_MODEL', '')
    ai_enabled: bool = os.getenv('AI_ENABLED', 'false').lower() == 'true'
    sharing_enabled: bool = os.getenv('SHARING_ENABLED', 'false').lower() == 'true'
    @property
    def secure_cookies(self):return self.environment=='production'

    def validate(self):
        from cryptography.fernet import Fernet
        from urllib.parse import urlparse
        if len(self.jwt_key) < 48 or not self.encryption_key:
            raise RuntimeError('Set a random JWT_SECRET (48+ characters) and a Fernet ENCRYPTION_KEY. See api/README.md.')
        try:Fernet(self.encryption_key.encode())
        except Exception:raise RuntimeError('ENCRYPTION_KEY must be a valid Fernet key.')
        url=urlparse(self.origin)
        if url.scheme not in ['https','http'] or not url.hostname or url.path not in ['', '/'] or url.query or url.fragment or url.username:
            raise RuntimeError('APP_ORIGIN must be a plain HTTP(S) origin without a path or credentials.')
        if self.environment == 'production':
            if not self.origin.startswith('https://') or not self.database_url.startswith('postgresql'):
                raise RuntimeError('Production requires HTTPS APP_ORIGIN and PostgreSQL DATABASE_URL.')
            if not self.smtp_host or not self.mail_from:
                raise RuntimeError('Production requires SMTP delivery for verification and recovery.')
        if not 0 <= self.trial_days <= 30:
            raise RuntimeError('TRIAL_DAYS must be between 0 and 30.')
        if self.billing_enabled and self.environment!='test':
            if not self.stripe_key.startswith(('sk_test_','sk_live_')) or not self.webhook_key.startswith('whsec_') or not all(p.startswith('price_') for p in [self.monthly_price,self.annual_price]) or self.monthly_price==self.annual_price:
                raise RuntimeError('Billing requires a Stripe secret, webhook signing secret and distinct monthly/annual price IDs.')
            if self.stripe_key.startswith('sk_live_') and not self.allow_live_billing:
                raise RuntimeError('Live billing requires explicit ALLOW_LIVE_BILLING=true after merchant and price acceptance.')

