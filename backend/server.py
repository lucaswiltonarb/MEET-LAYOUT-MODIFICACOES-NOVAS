"""
FastAPI proxy server that forwards /api/* requests to the Next.js server
running on localhost:3000.

This is needed because the Kubernetes ingress sends any path starting with
/api to this backend (port 8001), but the Next.js app has its API routes
(token, user, webhooks) on port 3000. We proxy them through so that the
Stream/Clerk integration keeps working with the original /api/* URLs.
"""
import os
import logging
import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

NEXT_INTERNAL_URL = os.environ.get("NEXT_INTERNAL_URL", "http://localhost:3000")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api-proxy")

app = FastAPI(title="Google Meet Clone - API Proxy")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok", "proxy_target": NEXT_INTERNAL_URL}


# Hop-by-hop / problematic headers that must NOT be forwarded
EXCLUDED_REQUEST_HEADERS = {
    "host",
    "content-length",
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
}
EXCLUDED_RESPONSE_HEADERS = {
    "content-encoding",
    "content-length",
    "transfer-encoding",
    "connection",
    "keep-alive",
}


@app.api_route(
    "/api/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
)
async def proxy_api(path: str, request: Request):
    url = f"{NEXT_INTERNAL_URL}/api/{path}"
    body = await request.body()

    headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in EXCLUDED_REQUEST_HEADERS
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            upstream = await client.request(
                request.method,
                url,
                content=body,
                headers=headers,
                params=request.query_params,
            )
    except httpx.ConnectError as e:
        logger.error(f"Cannot reach Next.js dev server at {url}: {e}")
        return Response(
            content=f'{{"error":"Next.js server not reachable at {NEXT_INTERNAL_URL}"}}',
            status_code=502,
            media_type="application/json",
        )

    resp_headers = {
        k: v for k, v in upstream.headers.items()
        if k.lower() not in EXCLUDED_RESPONSE_HEADERS
    }

    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=resp_headers,
        media_type=upstream.headers.get("content-type"),
    )
