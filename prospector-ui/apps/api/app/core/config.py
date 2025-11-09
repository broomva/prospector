"""Application configuration using Pydantic settings."""

from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="allow",
    )

    # API Configuration
    api_host: str = Field(default="0.0.0.0", description="API host")
    api_port: int = Field(default=8000, description="API port")
    api_reload: bool = Field(default=True, description="Auto-reload on code changes")
    log_level: str = Field(default="info", description="Logging level")

    # CORS Configuration
    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:3001",
        description="Comma-separated CORS origins"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins string into list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    # LangChain / Model Configuration
    anthropic_api_key: str = Field(default="", description="Anthropic API key")
    openai_api_key: str = Field(default="", description="OpenAI API key")
    model_name: str = Field(
        default="claude-sonnet-4-5-20250929",
        description="Anthropic model name (e.g., claude-sonnet-4-5-20250929, claude-3-5-sonnet-20241022)"
    )

    # LangSmith (observability)
    langchain_tracing_v2: bool = Field(default=False, description="Enable LangSmith tracing")
    langchain_api_key: str = Field(default="", description="LangSmith API key")
    langchain_project: str = Field(
        default="prospector-deepagent",
        description="LangSmith project name"
    )

    # Database Configuration
    database_url: str = Field(
        default="file:../mastra.db",
        description="Database URL for contacts data"
    )

    # Agent Configuration
    max_iterations: int = Field(default=25, description="Max agent iterations")
    checkpoint_enabled: bool = Field(default=True, description="Enable checkpointing")


# Global settings instance
settings = Settings()
