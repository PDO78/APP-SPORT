FROM python:3.12-slim
WORKDIR /service
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --uid 10001 --create-home sport && mkdir /data && chown sport:sport /data
COPY --chown=sport:sport app.py login.py ./
USER sport
EXPOSE 8766
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8766", "--workers", "1", "--no-access-log"]
