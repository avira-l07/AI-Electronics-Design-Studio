"""Opt-in local inference. Fixed loopback destination, no pull or cloud fallback."""
import json
import threading
import httpx
from api.security import fail

_running = threading.BoundedSemaphore(1)
_base = 'http://127.0.0.1:11434'


def _read(client, path, payload=None):
    method = 'GET' if payload is None else 'POST'
    with client.stream(method, _base + path, **({} if payload is None else {'json':payload})) as response:
        if response.status_code != 200:
            fail(502, 'Local AI is unavailable. No project changes were made.')
        raw = bytearray()
        for chunk in response.iter_bytes():
            raw.extend(chunk)
            if len(raw) > 262144:
                fail(502, 'Local AI response exceeded the permitted size.')
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError('Invalid local response')
    return value


def installed(client, model):
    models = _read(client, '/api/tags').get('models', [])
    if not isinstance(models, list) or not any(isinstance(m, dict) and m.get('name') == model for m in models):
        fail(503, 'Start Ollama with the already-installed phi4-mini:3.8b model. No model is downloaded automatically.')


def check_local_model(model):
    try:
        with httpx.Client(timeout=5, follow_redirects=False, trust_env=False) as client:
            installed(client, model)
    except (httpx.HTTPError, ValueError, TypeError):
        fail(503, 'Start the loopback Ollama service first. No cloud fallback is used.')


def generate(settings, question, context, schema, instructions):
    # Validate on every request too, guarding accidental runtime reconfiguration.
    settings.validate()
    if settings.ai_provider != 'ollama' or not settings.ai_ready:
        fail(503, 'Local AI is disabled.')
    if not _running.acquire(blocking=False):
        fail(429, 'Local AI is busy. Wait for the current request to finish.')
    try:
        with httpx.Client(timeout=httpx.Timeout(90, connect=3), follow_redirects=False, trust_env=False) as client:
            installed(client, settings.ollama_model)
            payload = {'model':settings.ollama_model, 'system':instructions,
                'prompt':json.dumps({'question':question, 'project_context':context}),
                'stream':False, 'keep_alive':0,
                'options':{'temperature':0, 'num_ctx':2048, 'num_predict':1200}}
            if schema:
                payload['format'] = schema
            result = _read(client, '/api/generate', payload)
        answer = result.get('response')
        if result.get('done') is not True or result.get('done_reason') != 'stop' or not isinstance(answer, str) or not answer.strip():
            fail(502, 'Local AI returned an incomplete response. No project changes were made.')
        return answer[:20000]
    except (httpx.HTTPError, ValueError, TypeError, KeyError):
        fail(502, 'Local AI is unavailable. No project changes were made.')
    finally:
        _running.release()
