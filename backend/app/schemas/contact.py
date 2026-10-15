from pydantic import BaseModel, Field, field_validator


class ContactTicketRequest(BaseModel):
    subject: str = Field(min_length=3, max_length=120)
    message: str = Field(min_length=20, max_length=4000)
    # Honeypot — must stay empty (bots often fill hidden fields).
    website: str = Field(default="", max_length=200)
    started_at_ms: int = Field(ge=1)

    @field_validator("subject", "message")
    @classmethod
    def strip_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Value cannot be empty")
        return cleaned
