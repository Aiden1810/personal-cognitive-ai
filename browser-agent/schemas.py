from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, StringConstraints, field_validator

Query = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Criterion = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)]


class SearchPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")
    objective: str = Field(min_length=1, max_length=500)
    queries: list[Query] = Field(min_length=1, max_length=3)
    criteria: list[Criterion] = Field(min_length=1, max_length=6)


class TaskInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    requestId: str
    task: str = Field(min_length=1, max_length=2000)
    plan: SearchPlan

    @field_validator("requestId")
    @classmethod
    def valid_id(cls, value: str) -> str:
        return str(UUID(value))

    @field_validator("task")
    @classmethod
    def nonempty_task(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("task is empty")
        return value.strip()


class Resource(BaseModel):
    model_config = ConfigDict(extra="forbid")
    url: HttpUrl
    title: str = Field(min_length=1, max_length=500)
    excerpt: str = Field(min_length=1, max_length=1200)
    visitedAt: str = Field(min_length=1, max_length=50)
