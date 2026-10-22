FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY api/requirements.lock /app/api/requirements.lock
RUN pip install --no-cache-dir -r api/requirements.lock && useradd --uid 10001 --create-home studio
COPY --chown=studio:studio api /app/api
COPY --chown=studio:studio dist /app/dist
USER studio
EXPOSE 8000
CMD ["python","-m","uvicorn","api.app:run_app","--factory","--host","0.0.0.0","--port","8000","--proxy-headers","--forwarded-allow-ips=172.30.0.10,127.0.0.1"]
