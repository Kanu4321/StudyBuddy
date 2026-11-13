from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.auth import hash_password, verify_password, create_access_token, get_current_user
from app.schemas.auth import SignupRequest, LoginRequest, AuthResponse, UserResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post(
    "/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new student account",
)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    # Check if email is already taken
    existing_user = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    # Create new registered user
    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        is_guest=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": user.id})
    return AuthResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Log in with email and password",
)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    # Look up user by email
    user = db.query(User).filter(User.email == payload.email.lower()).first()

    # Constant time check or generic failure to avoid account enumeration
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(data={"sub": user.id})
    return AuthResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post(
    "/guest",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create anonymous guest session",
)
def guest_login(db: Session = Depends(get_db)):
    user = User(
        email=None,
        password_hash=None,
        is_guest=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": user.id})
    return AuthResponse(access_token=token, user=UserResponse.model_validate(user))


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get authenticated student profile",
)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)
