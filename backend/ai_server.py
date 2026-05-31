"""
LockIn AI Server
FastAPI backend that calls Gemini to generate productivity session suggestions.

Setup:
  cd backend
  .venv/bin/pip install fastapi uvicorn pydantic google-genai

Run:
  .venv/bin/uvicorn ai_server:app --reload --port 8000
  OR
  .venv/bin/python ai_server.py --port 8000

The Chrome extension calls POST /suggest-sessions with session history JSON.
Uses Gemini 1.5 Flash model.
"""

import os
import sys
import json
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "YOUR_API_KEY_HERE")
client = genai.Client(api_key=GEMINI_API_KEY)

app = FastAPI(title="LockIn AI Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ActualPerformance(BaseModel):
    focusedMinutes: Optional[int] = 0
    breaksTaken:    Optional[int] = 0
    idleMinutes:    Optional[int] = 0


class SessionRecord(BaseModel):
    datetime:         Optional[str]  = None
    duration:         Optional[int]  = 0
    focusSites:       Optional[dict] = {}
    streakDays:       Optional[int]  = 0
    idleMinutes:      Optional[int]  = 0
    breakFrequency:   Optional[int]  = 0
    breakDuration:    Optional[int]  = 5
    scheduledStart:   Optional[str]  = None
    scheduledEnd:     Optional[str]  = None
    actualPerformance: Optional[ActualPerformance] = None


class SuggestRequest(BaseModel):
    history: List[SessionRecord]


class SessionSuggestion(BaseModel):
    title:          str
    startTime:      str
    endTime:        str
    breakFrequency: int
    breakDuration:  int
    detail:         str


class SuggestResponse(BaseModel):
    suggestions: List[SessionSuggestion]
    raw_analysis: Optional[str] = None


def parse_gemini_response(text: str) -> List[dict]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = [l for l in lines if not l.startswith("```")]
        cleaned = "\n".join(lines).strip()

    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "suggestions" in data:
            return data["suggestions"]
    except json.JSONDecodeError:
        pass

    start = cleaned.find("[")
    end   = cleaned.rfind("]") + 1
    if start >= 0 and end > start:
        try:
            return json.loads(cleaned[start:end])
        except json.JSONDecodeError:
            pass

    return []


@app.post("/suggest-sessions", response_model=SuggestResponse)
async def suggest_sessions(request: SuggestRequest):
    history = request.history

    if len(history) < 3:
        raise HTTPException(
            status_code=400,
            detail="Need at least 3 completed sessions to generate suggestions."
        )

    history_json = json.dumps(
        [h.model_dump() for h in history],
        default=str,
        indent=2
    )

    improvement_note = ""
    if len(history) % 3 == 0:
        improvement_note = (
            "This is a multiple-of-3 session count — provide noticeably improved "
            "recommendations compared to earlier suggestions."
        )

    prompt = f"""
You are a productivity coach AI for the LockIn Chrome extension.
Analyze the following session history and suggest exactly 2 optimized focus sessions.

Rules:
- Each suggestion must include: session title, total session time, start time, end time,
  break frequency (minutes between breaks), break duration (minutes), and a short explanation.
- Use idleMinutes and actualPerformance.idleMinutes from the history to determine optimal
  break frequency. If the user typically idles after ~25 minutes, suggest breaks every 25-30 minutes.
- Use patterns in datetime to suggest the best time of day.
- Every 3 sessions, meaningfully improve the recommendations (longer sessions, better timing, etc.).
- {improvement_note}

Return ONLY a JSON array (no markdown, no extra text) with exactly this structure:
[
  {{
    "title": "90m Deep Work",
    "startTime": "09:00",
    "endTime": "10:30",
    "breakFrequency": 25,
    "breakDuration": 5,
    "detail": "Your most productive window is 9-10:30am. Short 5-min breaks every 25 min match your focus pattern."
  }},
  ...
]

Session history ({len(history)} sessions):
{history_json}
"""

    try:
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt
        )
        raw_text = response.text

        suggestions_raw = parse_gemini_response(raw_text)

        suggestions = []
        for s in suggestions_raw[:2]:
            suggestions.append(SessionSuggestion(
                title          = s.get("title",          "Focus Session"),
                startTime      = s.get("startTime",      "09:00"),
                endTime        = s.get("endTime",        "10:00"),
                breakFrequency = int(s.get("breakFrequency", 25)),
                breakDuration  = int(s.get("breakDuration",   5)),
                detail         = s.get("detail",         "")
            ))

        return SuggestResponse(suggestions=suggestions, raw_analysis=raw_text)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gemini API error: {str(e)}"
        )


@app.get("/health")
async def health():
    return {"status": "ok", "model": "gemini-1.5-flash"}


if __name__ == "__main__":
    import uvicorn
    port = 8000
    for i, arg in enumerate(sys.argv):
        if arg == "--port" and i + 1 < len(sys.argv):
            port = int(sys.argv[i + 1])
    uvicorn.run(app, host="0.0.0.0", port=port, reload=True)