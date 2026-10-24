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
    mail_transport: str = os.getenv('MAIL_TRANSPORT', 'smtp')
    resend_key: str = os.getenv('RESEND_API_KEY', '')
    inline_mail: bool = os.getenv('INLINE_MAIL', 'false').lower() == 'true'
    free_beta: bool = os.getenv('FREE_BETA', 'false').lower() == 'true'
    login_confirmation_ttl: int = int(os.getenv('LOGIN_CONFIRMATION_TTL_SECONDS', '1200'))
    ai_key: str = os.getenv('OPENAI_API_KEY', '')
    ai_model: str = os.getenv('OPENAI_MODEL', '')
    ai_enabled: bool = os.getenv('AI_ENABLED', 'false').lower() == 'true'
    ai_provider: str = os.getenv('AI_PROVIDER', 'openai')
    ollama_model: str = os.getenv('OLLAMA_MODEL', 'phi4-mini:3.8b')
    sharing_enabled: bool = os.getenv('SHARING_ENABLED', 'false').lower() == 'true'
    @property
    def secure_cookies(self):return self.environment=='production'
    @property
    def mail_ready(self):return bool(self.mail_from and (self.resend_key if self.mail_transport=='resend' else self.smtp_host))
    @property
    def selected_ai_model(self):return self.ollama_model if self.ai_provider=='ollama' else self.ai_model
    @property
    def ai_ready(self):return bool(self.ai_enabled and (self.ollama_model if self.ai_provider=='ollama' else self.ai_key and self.ai_model))

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
            if not self.mail_ready:
                raise RuntimeError('Production requires configured email delivery for verification and recovery.')
        if self.mail_transport not in ['smtp','resend']:
            raise RuntimeError('MAIL_TRANSPORT must be smtp or resend.')
        if self.inline_mail and (not self.free_beta or self.mail_transport!='resend' or not self.mail_ready):
            raise RuntimeError('INLINE_MAIL requires FREE_BETA and configured Resend HTTPS delivery.')
        if self.ai_provider not in ['openai','ollama']:
            raise RuntimeError('AI_PROVIDER must be openai or ollama.')
        if self.ai_enabled and self.ai_provider=='ollama':
            if self.environment not in ['test','development'] or url.hostname not in ['127.0.0.1','localhost','::1']:
                raise RuntimeError('Ollama is supported only in local development with a loopback APP_ORIGIN.')
            if self.ollama_model!='phi4-mini:3.8b':
                raise RuntimeError('This local beta adapter supports the installed phi4-mini:3.8b model only.')
        if self.free_beta and (self.billing_enabled or self.allow_live_billing or self.stripe_key.startswith('sk_live_') or (self.ai_enabled and self.ai_provider!='ollama')):
            raise RuntimeError('FREE_BETA prohibits live billing credentials/activation and paid live AI.')
        if not 0 <= self.trial_days <= 30:
            raise RuntimeError('TRIAL_DAYS must be between 0 and 30.')
        if type(self.login_confirmation_ttl)!=int or not 600<=self.login_confirmation_ttl<=1800:
            raise RuntimeError('LOGIN_CONFIRMATION_TTL_SECONDS must be between 600 and 1800 seconds.')
        if self.billing_enabled and self.environment!='test':
            if not self.stripe_key.startswith(('sk_test_','sk_live_')) or not self.webhook_key.startswith('whsec_') or not all(p.startswith('price_') for p in [self.monthly_price,self.annual_price]) or self.monthly_price==self.annual_price:
                raise RuntimeError('Billing requires a Stripe secret, webhook signing secret and distinct monthly/annual price IDs.')
            if self.stripe_key.startswith('sk_live_') and not self.allow_live_billing:
                raise RuntimeError('Live billing requires explicit ALLOW_LIVE_BILLING=true after merchant and price acceptance.')

