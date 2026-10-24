from fastapi.responses import JSONResponse
from threading import BoundedSemaphore

class FreeBetaCapacity:
    """Limit simultaneous mutating handlers on the small single-process beta.

    Rate limits constrain frequency; this separately bounds concurrent Argon2
    allocations. Excess requests receive backpressure instead of an unbounded
    password-work queue. This is per process, not a distributed quota.
    """
    def __init__(self,app):self.app=app;self.slots=BoundedSemaphore(2)
    async def __call__(self,scope,receive,send):
        limited=scope['type']=='http' and scope['path'].startswith('/api/') and scope['method'] in ['POST','PATCH','DELETE']
        if not limited:return await self.app(scope,receive,send)
        if not self.slots.acquire(blocking=False):
            return await JSONResponse({'detail':'The free beta is busy. Please retry in a moment.'},429,headers={'Retry-After':'2'})(scope,receive,send)
        try:await self.app(scope,receive,send)
        finally:self.slots.release()

class BodyLimitMiddleware:
    """Bound buffered API bodies even when Content-Length is absent or false."""
    def __init__(self,app,maximum=1024*1024):self.app=app;self.maximum=maximum
    async def __call__(self,scope,receive,send):
        if scope['type']!='http' or not scope['path'].startswith('/api/') or scope['method'] not in ['POST','PATCH','DELETE']:
            return await self.app(scope,receive,send)
        messages=[];size=0
        while True:
            message=await receive()
            if message['type']=='http.disconnect':return
            size+=len(message.get('body',b''))
            if size>self.maximum:
                return await JSONResponse({'detail':'Request too large'},413)(scope,receive,send)
            messages.append(message)
            if not message.get('more_body',False):break
        async def replay():
            if messages:return messages.pop(0)
            return await receive()
        return await self.app(scope,replay,send)
