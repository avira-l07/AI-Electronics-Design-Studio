"""Public frontend only; deny accidental private/runtime files inside it too."""
from pathlib import PurePosixPath
from fastapi import HTTPException
from fastapi.staticfiles import StaticFiles

class PublicFrontend(StaticFiles):
    async def get_response(self,path,scope):
        parts=PurePosixPath(path.replace('\\','/')).parts
        lower=path.lower()
        if any(part.startswith('.') for part in parts) or lower.endswith(('.env','.db','.db-wal','.db-shm','.sqlite','.sqlite3','.sqlite-wal','.sqlite-shm','.py','.pyc','.pyo','.sql','.yaml','.yml','.toml','.pem','.key','.log')):
            raise HTTPException(404,'Not found')
        return await super().get_response(path,scope)
