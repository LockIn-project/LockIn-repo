"""
LockIn AI Server
FastAPI backend that calls Gemini to generate productivity session suggestions.

Setup:
  pip install fastapi uvicorn google-generativeai

Run:
  uvicorn ai_server:app --reload --port 8000

The Chrome extension calls POST /suggest-sessions with session history JSON.
Uses Gemini 1.5 Flash model.
"""

import os
import json
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Gemini API call here ───────────────────────────────────────────────────────
import google.generativeai as genai

# Configure Gemini API — replace with your actual key or set GEMINI_API_KEY env var
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "YOUR_API_KEY_HERE")
genai.configure(api_key=GEMINI_API_KEY)

# Use Gemini 1.5 Flash model
model = genai.GenerativeModel("gemini-1.5-flash")  # <-- Gemini API call here


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(title="LockIn AI Server", version="1.0.0")

# Allow Chrome extension to call this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ─────────────────────────────────────────────────
class ActualPerformance(BaseModel):
    focusedMinutes: Optional[int] = 0
    breaksTaken:    Optional[int] = 0
    idleMinutes:    Optional[int] = 0


class SessionRecord(BaseModel):
    datetime:         Optional[str]  = None
    duration:         Optional[int]  = 0   # total minutes
    focusSites:       Optional[dict] = {}
    streakDays:       Optional[int]  = 0
    idleMinutes:      Optional[int]  = 0
    breakFrequency:   Optional[int]  = 0   # minutes between breaks
    breakDuration:    Optional[int]  = 5   # minutes per break
    scheduledStart:   Optional[str]  = None
    scheduledEnd:     Optional[str]  = None
    actualPerformance: Optional[ActualPerformance] = None


class SuggestRequest(BaseModel):
    history: List[SessionRecord]


class SessionSuggestion(BaseModel):
    title:          str
    startTime:      str   # e.g. "14:00"
    endTime:        str   # e.g. "16:00"
    breakFrequency: int   # minutes between breaks
    breakDuration:  int   # minutes per break
    detail:         str   # human-readable explanation


class SuggestResponse(BaseModel):
    suggestions: List[SessionSuggestion]
    raw_analysis: Optional[str] = None


# ── Helper: parse Gemini JSON output ─────────────────────────────────────────
def parse_gemini_response(text: str) -> List[dict]:
    """Extract JSON array from Gemini's response text."""
    # Strip markdown code fences if present
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Remove first and last fence lines
        lines = [l for l in lines if not l.startswith("```")]
        cleaned = "\n".join(lines).strip()

    # Try direct parse
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "suggestions" in data:
            return data["suggestions"]
    except json.JSONDecodeError:
        pass

    # Fallback: find JSON array in text
    start = cleaned.find("[")
    end   = cleaned.rfind("]") + 1
    if start >= 0 and end > start:
        try:
            return json.loads(cleaned[start:end])
        except json.JSONDecodeError:
            pass

    return []


# ── /suggest-sessions endpoint ────────────────────────────────────────────────
@app.post("/suggest-sessions", response_model=SuggestResponse)
async def suggest_sessions(request: SuggestRequest):
    """
    Accepts session history from the LockIn Chrome extension and returns
    AI-powered session suggestions using Gemini 1.5 Flash.
    """
    history = request.history

    if len(history) < 3:
        raise HTTPException(
            status_code=400,
            detail="Need at least 3 completed sessions to generate suggestions."
        )

    # Serialize history for the prompt
    history_json = json.dumps(
        [h.model_dump() for h in history],
        default=str,
        indent=2
    )

    # Determine improvement interval (every 3 sessions)
    improvement_note = ""
    if len(history) % 3 == 0:
        improvement_note = (
            "This is a multiple-of-3 session count — provide noticeably improved "
            "recommendations compared to earlier suggestions."
        )

    # ── Gemini API call here ──────────────────────────────────────────────────
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
        response = model.generate_content(prompt)  # <-- Gemini API call here
        raw_text = response.text

        suggestions_raw = parse_gemini_response(raw_text)

        suggestions = []
        for s in suggestions_raw[:2]:  # cap at 2
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


# ── Health check ───────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "model": "gemini-1.5-flash"}


# ── Run directly ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)