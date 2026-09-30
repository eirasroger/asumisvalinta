"""Chat model interface and the OpenAI-compatible implementation."""

import os
from dataclasses import dataclass, field
from typing import Any, Protocol

DEFAULT_BASE_URL = "https://api.openai.com/v1"
DEFAULT_MODEL = "gpt-5.4-mini-2026-03-17"


@dataclass(frozen=True)
class LLMSettings:
    base_url: str
    model: str
    api_key: str
    reasoning_effort: str | None = None

    @classmethod
    def from_env(cls) -> "LLMSettings":
        api_key = os.environ.get("ASUMISVALINTA_LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("Set ASUMISVALINTA_LLM_API_KEY in the environment or in .env")
        return cls(
            base_url=os.environ.get("ASUMISVALINTA_LLM_BASE_URL") or DEFAULT_BASE_URL,
            model=os.environ.get("ASUMISVALINTA_LLM_MODEL") or DEFAULT_MODEL,
            api_key=api_key,
            reasoning_effort=os.environ.get("ASUMISVALINTA_LLM_REASONING_EFFORT") or None,
        )


@dataclass(frozen=True)
class ToolCall:
    id: str
    name: str
    arguments: str


@dataclass(frozen=True)
class ChatResponse:
    content: str | None
    tool_calls: tuple[ToolCall, ...] = ()
    prompt_tokens: int = 0
    completion_tokens: int = 0

    def as_message(self) -> dict[str, Any]:
        message: dict[str, Any] = {"role": "assistant", "content": self.content}
        if self.tool_calls:
            message["tool_calls"] = [
                {
                    "id": call.id,
                    "type": "function",
                    "function": {"name": call.name, "arguments": call.arguments},
                }
                for call in self.tool_calls
            ]
        return message


class ChatModel(Protocol):
    name: str

    def complete(
        self, messages: list[dict[str, Any]], tools: list[dict[str, Any]]
    ) -> ChatResponse: ...


@dataclass
class OpenAIChatModel:
    settings: LLMSettings
    name: str = field(init=False)

    def __post_init__(self) -> None:
        from openai import OpenAI

        self.name = self.settings.model
        self._client = OpenAI(base_url=self.settings.base_url, api_key=self.settings.api_key)

    def complete(self, messages: list[dict[str, Any]], tools: list[dict[str, Any]]) -> ChatResponse:
        options: dict[str, Any] = {}
        if self.settings.reasoning_effort:
            options["reasoning_effort"] = self.settings.reasoning_effort
        response = self._client.chat.completions.create(
            model=self.settings.model, messages=messages, tools=tools, **options
        )
        message = response.choices[0].message
        usage = response.usage
        return ChatResponse(
            content=message.content,
            tool_calls=tuple(
                ToolCall(call.id, call.function.name, call.function.arguments)
                for call in message.tool_calls or ()
            ),
            prompt_tokens=usage.prompt_tokens if usage else 0,
            completion_tokens=usage.completion_tokens if usage else 0,
        )
