from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

class Credentials(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator('email')
    @classmethod
    def normalize(cls, value):
        return str(value).strip().lower()

    @field_validator('password')
    @classmethod
    def bcrypt_bytes(cls, value):
        if len(value.encode('utf-8')) > 72 or '\x00' in value:
            raise ValueError('Password must fit 72 UTF-8 bytes and contain no NUL')
        return value

class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    is_admin: bool

class TokenRead(BaseModel):
    access_token: str
    token_type: str = 'bearer'
