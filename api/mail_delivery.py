"""Durable outbox transport; fixed provider destination, no public token inbox."""
import json
import smtplib
import ssl
import threading
from email.message import EmailMessage

import httpx
from sqlalchemy import select
from starlette.concurrency import run_in_threadpool

from api.models import Mail, now
from api.security import decrypt


def send_message(settings, row, payload):
    if settings.mail_transport == 'resend':
        # Stable across a provider-accepted / DB-commit-failed retry. Provider
        # idempotency is bounded by its retention window, not exactly-once mail.
        with httpx.Client(timeout=5, follow_redirects=False) as client:
            response = client.post('https://api.resend.com/emails',
                headers={'Authorization': 'Bearer ' + settings.resend_key,
                         'Idempotency-Key': 'studio-mail-' + row.id},
                json={'from': settings.mail_from, 'to': [payload['to']],
                      'subject': payload['subject'], 'text': payload['body']})
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict) or not data.get('id'):
                raise ValueError('Email provider did not acknowledge delivery.')
        return
    message = EmailMessage()
    message['From'] = settings.mail_from
    message['To'] = payload['to']
    message['Subject'] = payload['subject']
    message['Message-ID'] = '<' + row.id + '@studio-outbox>'
    message.set_content(payload['body'])
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
        smtp.starttls(context=ssl.create_default_context())
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)


def deliver_pending(factory, settings, batch=2):
    if not settings.mail_ready:
        raise RuntimeError('Configure email delivery first.')
    sent = deferred = 0
    with factory.begin() as db:
        rows = list(db.scalars(select(Mail).where(Mail.sent == False,
            Mail.available <= now()).order_by(Mail.available, Mail.id)
            .limit(batch).with_for_update(skip_locked=True)))
        for row in rows:
            try:
                send_message(settings, row, json.loads(decrypt(settings, row.payload)))
            except (httpx.HTTPError, OSError, smtplib.SMTPException, ValueError):
                row.attempts += 1
                row.available = now() + min(3600, 30 * 2 ** min(row.attempts, 7))
                deferred += 1
            else:
                row.sent = True
                row.payload = ''
                sent += 1
    return {'sent': sent, 'deferred': deferred}


class RequestOutbox:
    """Opt-in free beta: drain two messages after a modifying response ends.

    No keep-alive polling or always-on worker. Sleep/restarts delay retries;
    pending encrypted messages resume on a later modifying API request.
    """
    def __init__(self, app, factory, settings):
        self.app, self.factory, self.settings = app, factory, settings
        self.running = threading.Lock()

    async def __call__(self, scope, receive, send):
        await self.app(scope, receive, send)
        if (scope['type'] == 'http' and scope['path'].startswith('/api/')
                and scope['method'] in ['POST', 'PATCH', 'DELETE']
                and scope['path'] != '/api/payments/webhook'
                and self.running.acquire(blocking=False)):
            try:
                await run_in_threadpool(deliver_pending, self.factory, self.settings)
            except Exception:
                # Delivery failure must not rewrite an already-sent response or
                # reveal provider responses, encrypted data or action links.
                import logging
                logging.getLogger(__name__).warning('Outbox deferred; inspect provider and database availability.')
            finally:
                self.running.release()
