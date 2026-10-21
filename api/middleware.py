from fastapi.responses import JSONResponse

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
