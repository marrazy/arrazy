from contextlib import asynccontextmanager
 
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
 
from api.routers import aqi, spotify

 
 
@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await spotify.spotify.aclose()
    await aqi.aqi_client.aclose()
 
 
app = FastAPI(title="arrazy API", lifespan=lifespan)
 
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://arrazy.com",
        "https://www.arrazy.com",
        "http://localhost:5173", 
    ],
    allow_methods=["GET"],
    allow_headers=["Content-Type"],
)
 
app.include_router(spotify.router, prefix="/v1")
app.include_router(aqi.router, prefix="/v1")
 
 
@app.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}