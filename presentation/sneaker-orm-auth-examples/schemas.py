from decimal import Decimal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

class Credentials(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator('email')
    @classmethod
    def normalized_email(cls, value):
        # Explicit lesson policy: case-insensitive account identifiers.
        return value.strip().lower()

    @field_validator('password')
    @classmethod
    def bcrypt_limit(cls, value):
        if len(value.encode('utf-8')) > 72 or '\x00' in value:
            raise ValueError('Password must fit 72 UTF-8 bytes and contain no NUL')
        return value

class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str

class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    price: Decimal

class OrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    status: str
    total: Decimal

class TokenRead(BaseModel):
    access_token: str
    token_type: str = 'bearer'
