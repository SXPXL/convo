import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/convocation_db"
    
    JWT_SECRET: str = "super_secret_access_token_key_change_me_in_production_123456"
    JWT_REFRESH_SECRET: str = "super_secret_refresh_token_key_change_me_in_production_789012"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    CLOUDINARY_CLOUD_NAME: str = "your_cloudinary_cloud_name"
    CLOUDINARY_API_KEY: str = "your_cloudinary_api_key"
    CLOUDINARY_API_SECRET: str = "your_cloudinary_api_secret"
    
    PORT: int = 8000

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
