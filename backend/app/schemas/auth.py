from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr = Field(..., description="Valid email address")
    password: str = Field(..., min_length=6, description="Password with minimum 6 characters")


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Valid email address")
    password: str = Field(..., description="User password")


class UserResponse(BaseModel):
    id: str
    email: Optional[str] = None
    is_guest: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
