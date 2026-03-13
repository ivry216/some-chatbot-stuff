"""FastAPI wrapper around the AnsweringAgent with conversational memory support."""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from chat_memory import ChatMemory
from agent import AnsweringAgent

app = FastAPI(title="SmartLog Chatbot API")

# Allow react dev server and other origins to access the API during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global singletons
agent: AnsweringAgent | None = None
memory = ChatMemory(max_turns=10)


@app.on_event("startup")
def startup():
    """Initialize the AnsweringAgent on startup."""
    global agent
    agent = AnsweringAgent()


# ── Request / Response models ──────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str
    session_id: Optional[str] = None


class DebugChunk(BaseModel):
    """Single retrieved chunk exposed in the debug panel."""
    doc: str
    meta: dict
    distance: Optional[float] = None
    section: str


class DebugInfo(BaseModel):
    """Everything the frontend debug panel needs."""
    retrieved_chunks: list[DebugChunk] = []
    context_sent_to_llm: str = ""
    history: list[dict] = []          # [{"question": ..., "answer": ...}, ...]


class ChatResponse(BaseModel):
    answer: str
    session_id: str
    debug: DebugInfo


# ── Endpoints ──────────────────────────────────────────────────────────

@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    """Main chat endpoint.

    Flow:
    1. Retrieve relevant docs from vector store based on question
    2. Build context string
    3. Inject conversation history into the messages
    4. Call Azure OpenAI and return the answer
    5. Store the Q/A pair in the session history for future context
    6. Return answer + debug info
    """
    session_id = request.session_id or str(uuid.uuid4())
    question = request.question.strip()

    # Step 1: Retrieve context  (fixed: removed session_id, fixed key names)
    results = agent.retrieve(question, top_k=5)
    docs = results.get("docs") or []
    metas = results.get("metas") or []
    dists = results.get("distances") or []
    section_labels = results.get("sections") or []

    # ── Build debug chunks ──
    debug_chunks: list[DebugChunk] = []

    if not docs:
        answer = "Sorry, I couldn't find any relevant information to answer your question."
        memory.add(session_id, question, answer)

        history_for_debug = [
            {"question": q, "answer": a} for q, a in memory.get(session_id)
        ]

        return ChatResponse(
            answer=answer,
            session_id=session_id,
            debug=DebugInfo(
                retrieved_chunks=[],
                context_sent_to_llm="",
                history=history_for_debug,
            ),
        )

    # Step 2: Build context string
    context_chunks: list[str] = []
    for idx, doc in enumerate(docs):
        meta = metas[idx] if idx < len(metas) else {}
        distance = dists[idx] if idx < len(dists) else None
        section_label = section_labels[idx] if idx < len(section_labels) else "unknown"
        snippet = doc if isinstance(doc, str) else str(doc)

        meta_summary = agent._highlight_meta(meta)
        header_parts = [f"Result {idx + 1}", f"section: {section_label}"]
        if isinstance(distance, (int, float)):
            header_parts.append(f"distance: {distance:.4f}")
        header = "[" + " | ".join(header_parts) + "]"
        if meta_summary:
            header += f" {meta_summary}"
        context_chunks.append(f"{header}\n{snippet}")

        debug_chunks.append(DebugChunk(
            doc=snippet,
            meta=meta,
            distance=float(distance) if isinstance(distance, (int, float)) else None,
            section=section_label,
        ))

    context = "\n\n".join(context_chunks)

    # Step 3: Build messages with conversation history
    system_prompt = (
        "You are SmartlogCopilot. Use only the provided context to answer the question. "
        "If the context does not contain the answer, state that you don't know. "
        "Format responses as clear paragraphs or bullet points when it helps. "
        "Be precise and concise in your answer, but don't leave out important details. "
    )

    messages = [
        {"role": "system", "content": [{"type": "text", "text": system_prompt}]},
    ]

    # Inject conversation history
    for previous_question, previous_answer in memory.get(session_id):
        messages.append({"role": "user", "content": [{"type": "text", "text": previous_question}]})
        messages.append({"role": "assistant", "content": [{"type": "text", "text": previous_answer}]})

    user_content = f"Context:\n{context.strip() or 'N/A'}\n\nQuestion:\n{question.strip()}"
    messages.append({"role": "user", "content": [{"type": "text", "text": user_content}]})

    # Step 4: Call Azure OpenAI
    payload = {
        "messages": messages,
        "temperature": 0.1,
        "top_p": 0.95,
        "max_tokens": 1000,
    }
    answer = agent._call_azure_openai(payload)

    # Step 5: Store in conversation history
    memory.add(session_id, question, answer)

    # Step 6: Build debug info
    history_for_debug = [
        {"question": q, "answer": a} for q, a in memory.get(session_id)
    ]

    return ChatResponse(
        answer=answer,
        session_id=session_id,
        debug=DebugInfo(
            retrieved_chunks=debug_chunks,
            context_sent_to_llm=context,
            history=history_for_debug,
        ),
    )


@app.get("/health")
def health():
    return {"status": "ok"}
