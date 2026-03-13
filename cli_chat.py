#!/usr/bin/env python3
"""
Simple console chat client for Smartlog Copilot.
Talks to the FastAPI backend, keeps session for memory.

Usage:
  $ python cli_chat.py
  $ python cli_chat.py --url http://localhost:8000  # if backend is running on a different URL
  $ python cli_chat.py --debug                      # show retrieved chunks and context
"""

import argparse
import json
import requests


def main():
    parser = argparse.ArgumentParser(description="Smartlog Copilot CLI Chat")
    parser.add_argument("--url", default="http://localhost:8000", help="Backend URL")
    parser.add_argument("--debug", action="store_true", help="Show debug info (retrieved chunks, context, history)")
    args = parser.parse_args()

    base_url = args.url.rstrip("/")
    session_id = None

    print("=" * 50)
    print(" Smartlog Copilot CLI Chat ")
    print(" Type 'exit' to quit. ")
    print(" Type 'new' to start a new session (clear memory). ")
    if args.debug:
        print(" Debug mode: ON ")
    print("=" * 50)
    print()

    while True:
        try:
            question = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting chat. Goodbye!")
            break

        if not question:
            continue
        if question.lower() == "exit":
            print("Exiting chat. Goodbye!")
            break
        if question.lower() == "new":
            session_id = None
            print("Started a new session. Memory cleared.")
            continue

        try:
            response = requests.post(
                f"{base_url}/chat",
                json={"question": question, "session_id": session_id},
                timeout=120,
            )
            response.raise_for_status()
            data = response.json()
            session_id = data.get("session_id")  # update session_id for the next turn
            answer = data.get("answer", "")
            print(f"\nCopilot: {answer}\n")

            # Debug output
            if args.debug and "debug" in data:
                debug = data["debug"]
                chunks = debug.get("retrieved_chunks", [])
                if chunks:
                    print(f"  --- Debug: {len(chunks)} chunks retrieved ---")
                    for i, chunk in enumerate(chunks):
                        dist = f"{chunk['distance']:.4f}" if chunk.get("distance") is not None else "N/A"
                        print(f"  [{i+1}] section: {chunk.get('section', '?')} | distance: {dist}")
                        meta = chunk.get("meta", {})
                        if meta:
                            meta_str = " | ".join(f"{k}: {v}" for k, v in meta.items() if isinstance(v, str))
                            if meta_str:
                                print(f"      meta: {meta_str}")
                        doc_preview = (chunk.get("doc", ""))[:120]
                        print(f"      doc: {doc_preview}...")
                    print()

                history = debug.get("history", [])
                if history:
                    print(f"  --- Session history: {len(history)} turns ---\n")

        except requests.exceptions.ConnectionError as e:
            print(f"Error: Could not connect to the backend. Please check the URL and try again.\n")
        except Exception as e:
            print(f"An error occurred: {e}\n")


if __name__ == "__main__":
    main()
