"use client";

import { useEffect, useRef, useState } from "react";

export default function Chatbot() {
  const barRef = useRef(null);
  const inputRef = useRef(null);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState([]);
  const [latestReply, setLatestReply] = useState("");
  const [sending, setSending] = useState(false);
  const [replyCopyFresh, setReplyCopyFresh] = useState(false);
  const [materialCopied, setMaterialCopied] = useState(false);
  const [inputEnabled, setInputEnabled] = useState(false);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Control" && !event.repeat) {
        event.preventDefault();
        const input = inputRef.current;
        if (!input) {
          return;
        }
        setInputEnabled((prev) => !prev);
      }
    };

    const onPointerDown = (event) => {
      const bar = barRef.current;
      if (!bar) {
        return;
      }
      if (!bar.contains(event.target)) {
        setInputEnabled(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, []);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    if (inputEnabled) {
      window.setTimeout(() => {
        input.focus();
        const length = input.value.length;
        input.setSelectionRange(length, length);
      }, 0);
    } else {
      input.blur();
    }
  }, [inputEnabled]);

  const onSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || sending) {
      return;
    }

    setMessage("");
    setSending(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Chat request failed");
      }

      const assistantReply = String(payload.reply || "").trim();
      if (assistantReply) {
        setLatestReply(assistantReply);
        setReplyCopyFresh(true);
        setHistory((prev) => [
          ...prev,
          { role: "user", content: trimmed },
          { role: "assistant", content: assistantReply }
        ]);
      }
    } catch (error) {
      const errorText = error instanceof Error ? error.message : "Unknown error";
      setLatestReply(`Error: ${errorText}`);
      setReplyCopyFresh(true);
    } finally {
      setSending(false);
    }
  };

  const onInputKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!sending && message.trim()) {
        void onSend();
      }
    }
  };

  const copyReply = async () => {
    if (!latestReply) {
      return;
    }
    try {
      await navigator.clipboard.writeText(latestReply);
      setReplyCopyFresh(false);
    } catch {
      setLatestReply("Error: Clipboard write failed");
      setReplyCopyFresh(true);
    }
  };

  const copyMaterial = async () => {
    try {
      const response = await fetch("/material.txt", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to fetch material.txt");
      }
      const text = await response.text();
      await navigator.clipboard.writeText(text);
      setMaterialCopied(true);
      window.setTimeout(() => setMaterialCopied(false), 1500);
    } catch {
      setLatestReply("Error: Could not copy /material.txt");
      setReplyCopyFresh(true);
    }
  };

  return (
    <div ref={barRef} className="chatbot-bar" role="group" aria-label="Chatbot controls">
      <input
        id="chatbot-input"
        ref={inputRef}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={onInputKeyDown}
        className={`chatbot-input ${inputEnabled ? "is-enabled" : "is-disabled"}`}
        type="text"
        autoComplete="off"
        readOnly={!inputEnabled}
        tabIndex={inputEnabled ? 0 : -1}
      />

      <button
        id="chatbot-copy"
        type="button"
        onClick={() => void copyReply()}
        className={`chatbot-btn ${replyCopyFresh ? "active" : ""}`}
        disabled={!latestReply}
      >
        C
      </button>

      <button
        id="chatbot-copy-material"
        type="button"
        onClick={() => void copyMaterial()}
        className={`chatbot-btn chatbot-btn-material ${materialCopied ? "active" : ""}`}
      >
        C
      </button>
    </div>
  );
}
