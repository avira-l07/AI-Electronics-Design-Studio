"""Single-process free-host entrypoint. No worker, paid service or keep-alive job."""
import ipaddress
import os
from urllib.parse import parse_qs, urlsplit


def configuration():
    origin = os.getenv('APP_ORIGIN') or os.getenv('RENDER_EXTERNAL_URL', '')
    if not origin.startswith('https://'):
        raise RuntimeError('Set APP_ORIGIN to the actual HTTPS service origin.')
    os.environ['APP_ORIGIN'] = origin.rstrip('/')
    url = os.getenv('DATABASE_URL', '')
    if url.startswith('postgresql://'):
        url = 'postgresql+psycopg://' + url[len('postgresql://'):]
    try:
        tls = parse_qs(urlsplit(url).query, keep_blank_values=True).get('sslmode', [])
    except ValueError:
        tls = []
    if not url.startswith('postgresql+psycopg://') or tls not in [['require'], ['verify-ca'], ['verify-full']]:
        raise RuntimeError('Use the external PostgreSQL URL with sslmode=require.')
    os.environ['DATABASE_URL'] = url
    proxies = os.getenv('TRUSTED_PROXY_IPS', '')
    if not proxies:
        raise RuntimeError('Configure verified platform proxy IPs/CIDRs; wildcard trust is not allowed.')
    for value in proxies.split(','):
        try:
            network = ipaddress.ip_network(value.strip(), strict=False)
        except ValueError:
            raise RuntimeError('TRUSTED_PROXY_IPS must contain verified IP addresses/CIDRs.') from None
        if network.prefixlen == 0:
            raise RuntimeError('Do not trust the entire Internet as a proxy.')
    if os.getenv('APP_ENV') != 'production' or os.getenv('FREE_BETA') != 'true':
        raise RuntimeError('Free hosting requires APP_ENV=production and FREE_BETA=true.')
    return proxies


def main():
    proxies = configuration()
    from api.config import Settings
    settings = Settings()
    settings.validate()
    # Explicit startup migration under the existing PostgreSQL advisory lock.
    # A migration failure prevents startup. Back up an existing DB before upgrade.
    from api.migrate import migrate
    migrate()
    import uvicorn
    uvicorn.run('api.app:run_app', factory=True, host='0.0.0.0',
                port=int(os.getenv('PORT', '10000')), workers=1,
                proxy_headers=True, forwarded_allow_ips=proxies)


if __name__ == '__main__':
    main()
